/**
 * Streaming aggregator for the Apple Health `export.xml` file.
 *
 * The export can be several gigabytes, so instead of building a DOM we scan the
 * text for the handful of tags we care about and roll every sample up into one
 * value per day as we go. Feed it text with `push()` in any chunk size, then call
 * `finish()`. It has no DOM or Node dependencies, so it runs in a Web Worker.
 */
import type {
  ActivityDay,
  AggKind,
  DayPoint,
  HealthSummary,
  MetricSeries,
  SleepNight,
  SourceInfo,
  SourceKind,
  Workout,
} from "./types";

const DAY_MS = 86_400_000;
const SIX_HOURS = 6 * 3_600_000;
const MAX_SOURCES = 127;

const Q = "HKQuantityTypeIdentifier";
const C = "HKCategoryTypeIdentifier";
const SLEEP = `${C}SleepAnalysis`;
const STAND_HOUR = `${C}AppleStandHour`;
const MINDFUL = `${C}MindfulSession`;
const HEART_RATE = `${Q}HeartRate`;
const ACTIVE_ENERGY = `${Q}ActiveEnergyBurned`;

/** Quantities that add up over a day. Everything else numeric is averaged. */
const SUM_TYPES = new Set(
  [
    "StepCount", "ActiveEnergyBurned", "BasalEnergyBurned", "FlightsClimbed",
    "AppleExerciseTime", "AppleStandTime", "AppleMoveTime", "TimeInDaylight",
    "PushCount", "SwimmingStrokeCount", "NikeFuel", "NumberOfTimesFallen",
    "InhalerUsage", "InsulinDelivery", "NumberOfAlcoholicBeverages",
  ].map((s) => Q + s),
);
const isSumType = (id: string) =>
  SUM_TYPES.has(id) || id.startsWith(`${Q}Distance`) || id.startsWith(`${Q}Dietary`);

/** Samples recorded during sleep are filed under the night (wake-up date). */
const NIGHT_TYPES = new Set([`${Q}AppleSleepingWristTemperature`, `${Q}AppleSleepingBreathingDisturbances`]);

// Attribute keys, pre-built so the hot loop doesn't allocate them per record.
const K_TYPE = ' type="';
const K_SOURCE = ' sourceName="';
const K_DEVICE = ' device="';
const K_UNIT = ' unit="';
const K_START = ' startDate="';
const K_END = ' endDate="';
const K_VALUE = ' value="';

const TAG_RE = /<(\/?)(Record|WorkoutStatistics|WorkoutActivity|Workout|ActivitySummary|Correlation|ExportDate)[\s/>]/g;

function attr(tag: string, key: string): string | undefined {
  const i = tag.indexOf(key);
  if (i === -1) return undefined;
  const start = i + key.length;
  const end = tag.indexOf('"', start);
  return end === -1 ? undefined : tag.slice(start, end);
}

function num(tag: string, key: string): number {
  const v = attr(tag, key);
  return v === undefined ? NaN : parseFloat(v);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeXml(s: string): string {
  if (s.indexOf("&") === -1) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e],
  );
}

// ---- dates -------------------------------------------------------------------
// Health dates look like "2024-03-01 07:45:12 +0100" (local wall time + offset).

const n2 = (s: string, i: number) => (s.charCodeAt(i) - 48) * 10 + (s.charCodeAt(i + 1) - 48);

/** Local wall-clock time of the sample, expressed as if it were UTC. */
function wallMs(s: string): number {
  return Date.UTC(n2(s, 0) * 100 + n2(s, 2), n2(s, 5) - 1, n2(s, 8), n2(s, 11), n2(s, 14), n2(s, 17));
}

function epochMs(s: string): number {
  if (s.length < 25) return wallMs(s);
  const offset = (n2(s, 21) * 60 + n2(s, 23)) * (s.charCodeAt(20) === 45 ? -1 : 1);
  return wallMs(s) - offset * 60_000;
}

export function dayToIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

// ---- units -------------------------------------------------------------------

function energyFactor(unit: string | undefined): number {
  return unit === "kJ" ? 1 / 4.184 : 1;
}

function toKm(value: number, unit: string | undefined): number {
  switch (unit) {
    case "mi": return value * 1.609344;
    case "m": return value / 1000;
    case "yd": return value * 0.0009144;
    case "ft": return value * 0.0003048;
    default: return value;
  }
}

function toMinutes(value: number, unit: string | undefined): number {
  if (unit === "s") return value / 60;
  if (unit === "hr" || unit === "h") return value * 60;
  return value;
}

// ---- workouts ----------------------------------------------------------------

const WORKOUT_NAMES: Record<string, string> = {
  TraditionalStrengthTraining: "Strength Training",
  FunctionalStrengthTraining: "Functional Strength",
  HighIntensityIntervalTraining: "HIIT",
  MixedCardio: "Mixed Cardio",
  MixedMetabolicCardioTraining: "Mixed Cardio",
  CoreTraining: "Core Training",
  StairClimbing: "Stair Stepper",
  PreparationAndRecovery: "Recovery",
  MindAndBody: "Mind & Body",
  CrossTraining: "Cross Training",
  SwimBikeRun: "Multisport",
  WheelchairWalkPace: "Wheelchair Walk",
  WheelchairRunPace: "Wheelchair Run",
  DownhillSkiing: "Downhill Skiing",
  CrossCountrySkiing: "Cross-Country Skiing",
  SurfingSports: "Surfing",
  PaddleSports: "Paddling",
  SkatingSports: "Skating",
  WaterFitness: "Water Fitness",
  FitnessGaming: "Fitness Gaming",
  UnderwaterDiving: "Diving",
};

export function workoutName(raw: string): string {
  const key = raw.replace("HKWorkoutActivityType", "");
  return WORKOUT_NAMES[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

interface WorkoutAcc {
  w: Workout;
  startMs: number;
  endMs: number;
  src: number;
  statEnergy?: number;
  statDistance?: number;
  actEnergy?: number;
  actDistance?: number;
  actAvgHr?: number;
  actMaxHr?: number;
}

// ---- per-type accumulators ---------------------------------------------------

const MODE_SUM = 0, MODE_AVG = 1, MODE_COUNT = 2, MODE_DURATION = 3, MODE_SLEEP = 4;

interface TypeAcc {
  id: string;
  mode: number;
  unit: string;
  scale: number;
  /** Sound levels are averaged as energy, not as raw decibels. */
  logAvg: boolean;
  night: boolean;
  samples: number;
  /** MODE_SUM: (dayHour * 128 + source) -> total. Resolved across sources in finish(). */
  hourly: Map<number, number>;
  /** MODE_AVG: day -> [sum, count, min, max]. */
  daily: Map<number, number[]>;
  /** MODE_COUNT / MODE_DURATION: day -> total. */
  totals: Map<number, number>;
}

function newTypeAcc(id: string, rawUnit: string, firstValue: string | undefined): TypeAcc {
  let mode: number;
  if (id === SLEEP) mode = MODE_SLEEP;
  else if (id.startsWith(C)) mode = id === MINDFUL ? MODE_DURATION : MODE_COUNT;
  else if (isSumType(id)) mode = MODE_SUM;
  else if (firstValue !== undefined && Number.isNaN(parseFloat(firstValue))) mode = MODE_COUNT;
  else mode = MODE_AVG;

  let unit = rawUnit, scale = 1, logAvg = false;
  if (rawUnit === "%") scale = 100; // HealthKit stores percentages as fractions
  else if (rawUnit === "Cal") unit = "kcal";
  else if (rawUnit === "kJ") { unit = "kcal"; scale = 1 / 4.184; }
  else if (rawUnit === "dBASPL") { unit = "dB"; logAvg = true; }
  if (mode === MODE_COUNT) unit = "count";
  if (mode === MODE_DURATION) unit = "min";

  return {
    id, mode, unit, scale, logAvg, night: NIGHT_TYPES.has(id), samples: 0,
    hourly: new Map(), daily: new Map(), totals: new Map(),
  };
}

// ---- sleep -------------------------------------------------------------------

const ST_INBED = 0, ST_UNSPEC = 1, ST_CORE = 2, ST_DEEP = 3, ST_REM = 4, ST_AWAKE = 5;

function sleepStage(value: string): number {
  switch (value.replace("HKCategoryValueSleepAnalysis", "")) {
    case "InBed": case "0": return ST_INBED;
    case "Asleep": case "AsleepUnspecified": case "1": return ST_UNSPEC;
    case "Awake": case "2": return ST_AWAKE;
    case "AsleepCore": case "3": return ST_CORE;
    case "AsleepDeep": case "4": return ST_DEEP;
    case "AsleepREM": case "5": return ST_REM;
    default: return -1;
  }
}

interface SleepAcc {
  night: number;
  src: number;
  mins: number[];
  sleepStart: number;
  sleepEnd: number;
}

// ---- the aggregator ----------------------------------------------------------

export class HealthAggregator {
  records = 0;
  private carry = "";
  private types = new Map<string, TypeAcc>();
  private sourceIdx = new Map<string, number>();
  private sources: SourceInfo[] = [];
  private sleep = new Map<number, SleepAcc>();
  private activity = new Map<string, ActivityDay>();
  private workouts: WorkoutAcc[] = [];
  private current: WorkoutAcc | null = null;
  private inWorkoutActivity = false;
  private correlationDepth = 0;
  private exportDate?: string;
  private lastYmd = -1;
  private lastDay = 0;

  /** Feed the next piece of the XML text. Chunks may split tags anywhere. */
  push(chunk: string): void {
    const text = this.carry ? this.carry + chunk : chunk;
    // A tag can't contain "<", so everything before the last "<" is complete.
    const cut = text.lastIndexOf("<");
    this.scan(text, cut === -1 ? text.length : cut);
    this.carry = cut === -1 ? "" : text.slice(cut);
  }

  private scan(text: string, limit: number): void {
    const re = TAG_RE;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null && m.index < limit) {
      const name = m[2];
      if (m[1]) {
        if (name === "Workout") this.closeWorkout();
        else if (name === "WorkoutActivity") this.inWorkoutActivity = false;
        else if (name === "Correlation") this.correlationDepth = Math.max(0, this.correlationDepth - 1);
        continue;
      }
      const end = text.indexOf(">", m.index);
      if (end === -1) break;
      const tag = text.slice(m.index, end + 1);
      const selfClosing = text.charCodeAt(end - 1) === 47; // "/"
      re.lastIndex = end + 1;
      switch (name) {
        case "Record": this.record(tag); break;
        case "Workout": this.openWorkout(tag); if (selfClosing) this.closeWorkout(); break;
        case "WorkoutStatistics": this.workoutStatistic(tag); break;
        case "WorkoutActivity": if (!selfClosing) this.inWorkoutActivity = true; break;
        case "ActivitySummary": this.activitySummary(tag); break;
        case "Correlation": if (!selfClosing) this.correlationDepth++; break;
        case "ExportDate": this.exportDate = attr(tag, K_VALUE)?.slice(0, 10); break;
      }
    }
  }

  private dayIndex(s: string): number {
    const ymd = n2(s, 0) * 1_000_000 + n2(s, 2) * 10_000 + n2(s, 5) * 100 + n2(s, 8);
    if (ymd !== this.lastYmd) {
      this.lastYmd = ymd;
      this.lastDay = Math.floor(Date.UTC(n2(s, 0) * 100 + n2(s, 2), n2(s, 5) - 1, n2(s, 8)) / DAY_MS);
    }
    return this.lastDay;
  }

  private source(tag: string, countRecord: boolean): number {
    const raw = attr(tag, K_SOURCE) ?? "Unknown";
    let idx = this.sourceIdx.get(raw);
    if (idx === undefined) {
      const name = decodeXml(raw);
      const device = attr(tag, K_DEVICE) ?? "";
      let kind: SourceKind = "other";
      if (device.includes("model:Watch")) kind = "watch";
      else if (device.includes("model:iPhone")) kind = "phone";
      else if (/watch/i.test(name)) kind = "watch";
      else if (/iphone/i.test(name)) kind = "phone";
      idx = this.sources.length;
      this.sources.push({ name, kind, records: 0 });
      this.sourceIdx.set(raw, idx);
    }
    if (countRecord) this.sources[idx].records++;
    return idx;
  }

  private record(tag: string): void {
    if (this.correlationDepth > 0) return; // blood pressure / food pairs repeat top-level records
    const type = attr(tag, K_TYPE);
    const start = attr(tag, K_START);
    if (!type || !start || start.length < 19) return;
    this.records++;
    const src = this.source(tag, true);
    const value = attr(tag, K_VALUE);
    let t = this.types.get(type);
    if (!t) {
      t = newTypeAcc(type, attr(tag, K_UNIT) ?? "", value);
      this.types.set(type, t);
    }
    t.samples++;

    switch (t.mode) {
      case MODE_SUM: {
        const v = parseFloat(value ?? "") * t.scale;
        if (!(v > 0)) return;
        const key = (this.dayIndex(start) * 24 + n2(start, 11)) * 128 + Math.min(src, MAX_SOURCES);
        t.hourly.set(key, (t.hourly.get(key) ?? 0) + v);
        return;
      }
      case MODE_AVG: {
        const v = parseFloat(value ?? "") * t.scale;
        if (Number.isNaN(v)) return;
        const day = t.night ? Math.floor((wallMs(start) + SIX_HOURS) / DAY_MS) : this.dayIndex(start);
        const a = t.daily.get(day);
        const x = t.logAvg ? Math.pow(10, v / 10) : v;
        if (!a) t.daily.set(day, [x, 1, v, v]);
        else {
          a[0] += x;
          a[1]++;
          if (v < a[2]) a[2] = v;
          if (v > a[3]) a[3] = v;
        }
        return;
      }
      case MODE_COUNT: {
        if (type === STAND_HOUR && !(value ?? "").endsWith("Stood")) return;
        const day = this.dayIndex(start);
        t.totals.set(day, (t.totals.get(day) ?? 0) + 1);
        return;
      }
      case MODE_DURATION: {
        const end = attr(tag, K_END);
        if (!end) return;
        const mins = (epochMs(end) - epochMs(start)) / 60_000;
        if (!(mins > 0) || mins > 1440) return;
        const day = this.dayIndex(start);
        t.totals.set(day, (t.totals.get(day) ?? 0) + mins);
        return;
      }
      case MODE_SLEEP:
        this.sleepSample(tag, start, value ?? "", src);
        return;
    }
  }

  private sleepSample(tag: string, start: string, value: string, src: number): void {
    const end = attr(tag, K_END);
    const stage = sleepStage(value);
    if (!end || end.length < 19 || stage < 0) return;
    const mins = (epochMs(end) - epochMs(start)) / 60_000;
    if (!(mins > 0) || mins > 1440) return;

    // A night runs 18:00 -> 18:00 and is named after the morning you wake up.
    const startWall = wallMs(start);
    const night = Math.floor((startWall + SIX_HOURS) / DAY_MS);
    const key = night * 128 + Math.min(src, MAX_SOURCES);
    let acc = this.sleep.get(key);
    if (!acc) {
      acc = { night, src, mins: [0, 0, 0, 0, 0, 0], sleepStart: Infinity, sleepEnd: -Infinity };
      this.sleep.set(key, acc);
    }
    acc.mins[stage] += mins;
    if (stage !== ST_INBED && stage !== ST_AWAKE) {
      const midnight = night * DAY_MS;
      acc.sleepStart = Math.min(acc.sleepStart, (startWall - midnight) / 60_000);
      acc.sleepEnd = Math.max(acc.sleepEnd, (wallMs(end) - midnight) / 60_000);
    }
  }

  private openWorkout(tag: string): void {
    this.closeWorkout();
    const start = attr(tag, K_START);
    const end = attr(tag, K_END);
    if (!start || !end) return;
    const startMs = epochMs(start);
    const endMs = epochMs(end);
    let duration = toMinutes(num(tag, ' duration="'), attr(tag, ' durationUnit="'));
    if (!(duration > 0)) duration = (endMs - startMs) / 60_000;

    const w: Workout = {
      type: workoutName(attr(tag, ' workoutActivityType="') ?? "Other"),
      d: start.slice(0, 10),
      time: start.slice(11, 16),
      duration,
      source: decodeXml(attr(tag, K_SOURCE) ?? "Unknown"),
    };
    // Exports from iOS 15 and earlier carry totals as attributes; newer ones use WorkoutStatistics.
    const dist = num(tag, ' totalDistance="');
    if (dist > 0) w.distanceKm = toKm(dist, attr(tag, ' totalDistanceUnit="'));
    const energy = num(tag, ' totalEnergyBurned="');
    if (energy > 0) w.energy = energy * energyFactor(attr(tag, ' totalEnergyBurnedUnit="'));

    this.current = { w, startMs, endMs, src: this.source(tag, false) };
    this.inWorkoutActivity = false;
  }

  private workoutStatistic(tag: string): void {
    const cur = this.current;
    const type = attr(tag, K_TYPE);
    if (!cur || !type) return;
    const unit = attr(tag, K_UNIT);
    const inActivity = this.inWorkoutActivity;
    if (type === HEART_RATE) {
      const avg = num(tag, ' average="');
      const max = num(tag, ' maximum="');
      if (inActivity) {
        if (avg > 0) cur.actAvgHr ??= avg;
        if (max > 0) cur.actMaxHr = Math.max(cur.actMaxHr ?? 0, max);
      } else {
        if (avg > 0) cur.w.avgHr = avg;
        if (max > 0) cur.w.maxHr = max;
      }
    } else if (type === ACTIVE_ENERGY) {
      const sum = num(tag, ' sum="') * energyFactor(unit);
      if (!(sum > 0)) return;
      if (inActivity) cur.actEnergy = (cur.actEnergy ?? 0) + sum;
      else cur.statEnergy = sum;
    } else if (type.startsWith(`${Q}Distance`)) {
      const sum = toKm(num(tag, ' sum="'), unit);
      if (!(sum > 0)) return;
      if (inActivity) cur.actDistance = (cur.actDistance ?? 0) + sum;
      else cur.statDistance = sum;
    }
  }

  private closeWorkout(): void {
    const cur = this.current;
    if (!cur) return;
    const w = cur.w;
    w.energy ??= cur.statEnergy ?? cur.actEnergy;
    w.distanceKm ??= cur.statDistance ?? cur.actDistance;
    w.avgHr ??= cur.actAvgHr;
    w.maxHr ??= cur.actMaxHr;
    this.workouts.push(cur);
    this.current = null;
    this.inWorkoutActivity = false;
  }

  private activitySummary(tag: string): void {
    const d = attr(tag, ' dateComponents="');
    if (!d) return;
    const f = energyFactor(attr(tag, ' activeEnergyBurnedUnit="'));
    const val = (key: string, fallback = 0) => {
      const v = num(tag, key);
      return Number.isFinite(v) ? v : fallback;
    };
    this.activity.set(d, {
      d,
      move: val(' activeEnergyBurned="') * f,
      moveGoal: val(' activeEnergyBurnedGoal="') * f,
      exercise: val(' appleExerciseTime="'),
      exerciseGoal: val(' appleExerciseTimeGoal="', 30),
      stand: val(' appleStandHours="'),
      standGoal: val(' appleStandHoursGoal="', 12),
    });
  }

  finish(meta: { fileName?: string } = {}): HealthSummary {
    if (this.carry) this.scan(this.carry, this.carry.length);
    this.carry = "";
    this.closeWorkout();

    const metrics: Record<string, MetricSeries> = {};
    let minDay = Infinity, maxDay = -Infinity;
    const seeDay = (day: number) => {
      if (day < minDay) minDay = day;
      if (day > maxDay) maxDay = day;
    };

    for (const t of this.types.values()) {
      if (t.mode === MODE_SLEEP) continue;
      const byDay = new Map<number, DayPoint>();
      if (t.mode === MODE_SUM) {
        for (const [day, v] of this.resolveHourly(t.hourly)) byDay.set(day, { d: "", v });
      } else if (t.mode === MODE_AVG) {
        for (const [day, [s, n, mn, mx]] of t.daily) {
          const v = t.logAvg ? 10 * Math.log10(s / n) : s / n;
          byDay.set(day, n > 1 ? { d: "", v, min: mn, max: mx } : { d: "", v });
        }
      } else {
        for (const [day, v] of t.totals) byDay.set(day, { d: "", v });
      }
      if (!byDay.size) continue;
      const points = [...byDay.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([day, p]) => {
          seeDay(day);
          const out: DayPoint = { d: dayToIso(day), v: round(p.v) };
          if (p.min !== undefined) out.min = round(p.min);
          if (p.max !== undefined) out.max = round(p.max);
          return out;
        });
      metrics[t.id] = { id: t.id, unit: t.unit, kind: kindOf(t.mode), samples: t.samples, points };
    }

    const sleep = this.resolveSleep();
    const activity = [...this.activity.values()]
      .filter((a) => a.move > 0 || a.exercise > 0 || a.stand > 0)
      .sort((a, b) => (a.d < b.d ? -1 : 1))
      .map((a) => ({ ...a, move: Math.round(a.move), moveGoal: Math.round(a.moveGoal) }));
    const workouts = this.resolveWorkouts();

    const isoDays = [
      ...sleep.map((s) => s.d),
      ...activity.map((a) => a.d),
      ...workouts.map((w) => w.d),
    ];
    for (const d of isoDays) seeDay(Math.floor(Date.parse(d) / DAY_MS));

    const distanceUnit = metrics[`${Q}DistanceWalkingRunning`]?.unit === "mi" ? "mi" : "km";

    return {
      version: 1,
      createdAt: new Date().toISOString(),
      exportDate: this.exportDate,
      fileName: meta.fileName,
      range: Number.isFinite(minDay)
        ? { start: dayToIso(minDay), end: dayToIso(maxDay) }
        : { start: "", end: "" },
      totalRecords: this.records,
      metrics,
      sleep,
      activity,
      workouts,
      sources: [...this.sources].sort((a, b) => b.records - a.records),
      distanceUnit,
    };
  }

  /**
   * Steps, distance and energy are recorded by both the iPhone and the Watch.
   * Per hour we keep the larger of the two devices (so hours when the watch was
   * off still count), and only fall back to third-party apps for hours neither
   * device covered - that's how we avoid double counting.
   */
  private resolveHourly(hourly: Map<number, number>): Map<number, number> {
    const bestTier = new Map<number, number>();
    const bestValue = new Map<number, number>();
    for (const [key, v] of hourly) {
      const dayHour = Math.floor(key / 128);
      const kind = this.sources[key % 128]?.kind ?? "other";
      const tier = kind === "other" ? 1 : 0;
      const t = bestTier.get(dayHour);
      if (t === undefined || tier < t || (tier === t && v > (bestValue.get(dayHour) ?? 0))) {
        bestTier.set(dayHour, tier);
        bestValue.set(dayHour, v);
      }
    }
    const daily = new Map<number, number>();
    for (const [dayHour, v] of bestValue) {
      const day = Math.floor(dayHour / 24);
      daily.set(day, (daily.get(day) ?? 0) + v);
    }
    return daily;
  }

  /** Several apps can log the same night; keep the most detailed source per night. */
  private resolveSleep(): SleepNight[] {
    const byNight = new Map<number, SleepAcc[]>();
    for (const acc of this.sleep.values()) {
      const list = byNight.get(acc.night);
      if (list) list.push(acc);
      else byNight.set(acc.night, [acc]);
    }
    const nights: SleepNight[] = [];
    for (const [night, accs] of byNight) {
      let best: SleepAcc | null = null;
      let bestScore = -1;
      for (const a of accs) {
        const staged = a.mins[ST_CORE] + a.mins[ST_DEEP] + a.mins[ST_REM];
        const asleep = staged > 0 ? staged : a.mins[ST_UNSPEC];
        if (asleep <= 0) continue;
        const score =
          (staged > 0 ? 2 : 0) + (this.sources[a.src]?.kind === "watch" ? 1 : 0) + Math.min(asleep, 1440) / 1441;
        if (score > bestScore) {
          best = a;
          bestScore = score;
        }
      }
      if (!best) continue;
      const m = best.mins;
      const staged = m[ST_CORE] + m[ST_DEEP] + m[ST_REM] > 0;
      const inBed = Math.max(...accs.map((a) => a.mins[ST_INBED]));
      const n: SleepNight = {
        d: dayToIso(night),
        asleep: Math.round(staged ? m[ST_CORE] + m[ST_DEEP] + m[ST_REM] : m[ST_UNSPEC]),
        awake: Math.round(m[ST_AWAKE]),
        rem: Math.round(m[ST_REM]),
        core: Math.round(m[ST_CORE]),
        deep: Math.round(m[ST_DEEP]),
        unspecified: staged ? 0 : Math.round(m[ST_UNSPEC]),
        source: this.sources[best.src]?.name ?? "Unknown",
      };
      if (inBed > 0) n.inBed = Math.round(inBed);
      if (Number.isFinite(best.sleepStart)) {
        n.start = Math.round(best.sleepStart);
        n.end = Math.round(best.sleepEnd);
      }
      nights.push(n);
    }
    return nights.sort((a, b) => (a.d < b.d ? -1 : 1));
  }

  /** Drop duplicate workouts logged by two apps for the same session. */
  private resolveWorkouts(): Workout[] {
    const quality = (x: WorkoutAcc) =>
      (this.sources[x.src]?.kind === "watch" ? 2 : 0) + (x.w.avgHr ? 1 : 0) + (x.w.distanceKm ? 0.5 : 0);
    const sorted = [...this.workouts].sort((a, b) => a.startMs - b.startMs);
    const kept: WorkoutAcc[] = [];
    for (const x of sorted) {
      const prev = kept[kept.length - 1];
      if (prev && prev.src !== x.src) {
        const overlap = Math.min(prev.endMs, x.endMs) - Math.max(prev.startMs, x.startMs);
        const shorter = Math.min(prev.endMs - prev.startMs, x.endMs - x.startMs);
        if (shorter > 0 && overlap > shorter / 2) {
          if (quality(x) > quality(prev)) kept[kept.length - 1] = x;
          continue;
        }
      }
      kept.push(x);
    }
    return kept.map(({ w }) => ({
      ...w,
      duration: round(w.duration, 1),
      distanceKm: w.distanceKm === undefined ? undefined : round(w.distanceKm, 2),
      energy: w.energy === undefined ? undefined : Math.round(w.energy),
      avgHr: w.avgHr === undefined ? undefined : Math.round(w.avgHr),
      maxHr: w.maxHr === undefined ? undefined : Math.round(w.maxHr),
    }));
  }
}

function kindOf(mode: number): AggKind {
  if (mode === MODE_SUM) return "sum";
  if (mode === MODE_AVG) return "avg";
  if (mode === MODE_DURATION) return "duration";
  return "count";
}

function round(v: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
