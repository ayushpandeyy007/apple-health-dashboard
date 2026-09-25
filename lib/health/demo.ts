import { ID } from "./catalog";
import { addDays } from "./series";
import type { ActivityDay, DayPoint, HealthSummary, MetricSeries, SleepNight, Workout } from "./types";

/** Deterministic, realistic sample data so the dashboard can be explored without an export. */
export function createDemoSummary(now = new Date()): HealthSummary {
  let seed = 20260925;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const noise = () => (rnd() + rnd() + rnd() - 1.5) / 0.5; // ~N(0,1)
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const N = 540;
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const series: Record<string, DayPoint[]> = {};
  const add = (id: string, d: string, v: number, min?: number, max?: number) => {
    const p: DayPoint = { d, v: Math.round(v * 100) / 100 };
    if (min !== undefined && max !== undefined) {
      p.min = Math.round(min);
      p.max = Math.round(max);
    }
    (series[id] ??= []).push(p);
  };
  const activity: ActivityDay[] = [];
  const sleep: SleepNight[] = [];
  const workouts: Workout[] = [];

  for (let i = 0; i < N; i++) {
    const d = addDays(end, i - (N - 1));
    const t = i / (N - 1);
    const date = new Date(`${d}T00:00:00Z`);
    const dow = date.getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const season = Math.sin((2 * Math.PI * (date.getUTCMonth() * 30.4 + date.getUTCDate() - 80)) / 365);

    // Workouts for the day
    const todays: Workout[] = [];
    const push = (type: string, time: string, duration: number, energy: number, avgHr: number, maxHr: number, distanceKm?: number) =>
      todays.push({ type, d, time, duration: Math.round(duration), energy: Math.round(energy), avgHr: Math.round(avgHr), maxHr: Math.round(maxHr), distanceKm: distanceKm && Math.round(distanceKm * 100) / 100, source: "Apple Watch (demo)" });
    if ([1, 3, 5].includes(dow) && rnd() < 0.8) {
      const km = clamp(5 + 2.5 * t + noise() * 1.2, 3, 12);
      const pace = 6.1 - 0.5 * t + noise() * 0.2;
      push("Running", "06:45", km * pace, km * 68, 150 + noise() * 5, 172 + noise() * 5, km);
    }
    if ([2, 4].includes(dow) && rnd() < 0.75) push("Strength Training", "18:30", 40 + noise() * 8, 230 + noise() * 30, 112 + noise() * 6, 148 + noise() * 8);
    if (dow === 6 && rnd() < 0.45) {
      const km = clamp(22 + noise() * 6, 12, 40);
      push("Cycling", "08:00", km * 3, km * 24, 132 + noise() * 6, 165 + noise() * 6, km);
    }
    if (dow === 0 && rnd() < 0.5) push("Yoga", "09:00", 30 + noise() * 5, 95 + noise() * 15, 92 + noise() * 5, 118 + noise() * 6);
    if (weekend && rnd() < 0.35) {
      const km = clamp(5 + noise() * 1.5, 2, 9);
      push("Walking", "17:30", km * 11.5, km * 55, 104 + noise() * 5, 128 + noise() * 6, km);
    }
    if (dow === 3 && rnd() < 0.25) push("HIIT", "19:00", 22 + noise() * 3, 210 + noise() * 20, 148 + noise() * 5, 178 + noise() * 4);
    workouts.push(...todays);
    const wMin = todays.reduce((a, w) => a + w.duration, 0);
    const wKcal = todays.reduce((a, w) => a + (w.energy ?? 0), 0);
    const wKm = todays.reduce((a, w) => a + (w.type === "Running" || w.type === "Walking" ? w.distanceKm ?? 0 : 0), 0);

    // Activity
    const steps = Math.round(clamp(7400 + 1100 * season + (weekend ? 1400 : 0) + noise() * 2100 + wKm * 1300, 1800, 32000));
    add(ID.steps, d, steps);
    add(ID.distance, d, steps * 0.00074 * (1 + noise() * 0.02));
    add(ID.flights, d, Math.max(0, Math.round(9 + noise() * 5)));
    const move = clamp(290 + steps * 0.026 + wKcal * 0.75 + noise() * 45, 120, 1600);
    const moveGoal = t < 0.4 ? 550 : 620;
    const exercise = Math.round(clamp(10 + noise() * 6 + wMin * 0.9 + steps / 2500, 0, 240));
    const stand = Math.round(clamp(10.5 + noise() * 1.8 - (weekend ? 1 : 0), 3, 17));
    add(ID.activeEnergy, d, move);
    add(ID.exercise, d, exercise);
    add(ID.standHour, d, stand);
    add(ID.daylight, d, clamp(55 + 35 * season + (weekend ? 45 : 0) + noise() * 25, 4, 300));
    activity.push({ d, move: Math.round(move), moveGoal, exercise, exerciseGoal: 30, stand, standGoal: 12 });

    // Heart & vitals
    const rhr = 61.5 - 5.5 * t + noise() * 1.4;
    const hrv = clamp(40 + 13 * t - (rhr - (61.5 - 5.5 * t)) * 2.2 + noise() * 6.5, 16, 120);
    const peak = todays.length ? Math.max(...todays.map((w) => w.maxHr ?? 0)) : 108 + noise() * 10;
    add(ID.heartRate, d, rhr + 19 + noise() * 3 + (todays.length ? 6 : 0), rhr - 5 + noise(), peak);
    add(ID.restingHr, d, Math.round(rhr));
    add(ID.walkingHr, d, Math.round(rhr + 38 + noise() * 3));
    add(ID.hrv, d, hrv);
    if (i % 4 === 0 || todays.some((w) => w.type === "Running")) add(ID.vo2max, d, 40.5 + 4.6 * t + noise() * 0.35);
    if (todays.some((w) => w.type === "Running")) add(ID.recovery, d, 24 + 6 * t + noise() * 3);
    add(ID.spo2, d, clamp(97.2 + noise() * 0.6, 94, 100), 94 + rnd() * 2, 99 + rnd());
    add(ID.respRate, d, 14.6 + noise() * 0.55);
    add(ID.wristTemp, d, 35.62 + noise() * 0.18);
    add(ID.noise, d, 63 + noise() * 3.5 + (weekend ? 3 : 0));
    if (rnd() < 0.7) add(ID.headphone, d, 68 + noise() * 4);
    if (i % 3 === 0) add(ID.weight, d, 74.8 - 2.6 * t + noise() * 0.3);
    if (rnd() < 0.35) add(ID.mindful, d, Math.round(5 + rnd() * 12));
    if (rnd() < 0.012) add(ID.highHr, d, 1);

    // Sleep (a few nights without the watch)
    if (rnd() < 0.93) {
      const asleep = clamp(412 + (weekend ? 30 : 0) + noise() * 38 + (hrv - 45) * 0.6, 250, 560);
      const deep = asleep * clamp(0.15 + noise() * 0.025, 0.08, 0.24);
      const rem = asleep * clamp(0.22 + noise() * 0.03, 0.12, 0.3);
      const awake = clamp(14 + noise() * 7, 2, 50);
      const start = Math.round(-55 + (weekend ? 40 : 0) + noise() * 32);
      sleep.push({
        d, asleep: Math.round(asleep), inBed: Math.round(asleep + awake + 12), awake: Math.round(awake),
        rem: Math.round(rem), deep: Math.round(deep), core: Math.round(asleep - deep - rem), unspecified: 0,
        start, end: Math.round(start + asleep + awake), source: "Apple Watch (demo)",
      });
      add(ID.breathing, d, clamp(1.2 + noise() * 0.6, 0.1, 4));
    }
  }

  const units: Record<string, string> = {
    [ID.steps]: "count", [ID.distance]: "km", [ID.flights]: "count", [ID.activeEnergy]: "kcal", [ID.exercise]: "min",
    [ID.standHour]: "count", [ID.daylight]: "min", [ID.heartRate]: "count/min", [ID.restingHr]: "count/min",
    [ID.walkingHr]: "count/min", [ID.hrv]: "ms", [ID.vo2max]: "mL/min·kg", [ID.recovery]: "count/min", [ID.spo2]: "%",
    [ID.respRate]: "count/min", [ID.wristTemp]: "degC", [ID.noise]: "dB", [ID.headphone]: "dB", [ID.weight]: "kg",
    [ID.mindful]: "min", [ID.highHr]: "count", [ID.breathing]: "count",
  };
  const kinds: Record<string, MetricSeries["kind"]> = {
    [ID.steps]: "sum", [ID.distance]: "sum", [ID.flights]: "sum", [ID.activeEnergy]: "sum", [ID.exercise]: "sum",
    [ID.standHour]: "count", [ID.daylight]: "sum", [ID.mindful]: "duration", [ID.highHr]: "count",
  };
  const perDay: Record<string, number> = { [ID.heartRate]: 420, [ID.steps]: 180, [ID.distance]: 180, [ID.activeEnergy]: 900, [ID.spo2]: 8, [ID.respRate]: 24, [ID.noise]: 40 };
  const metrics: Record<string, MetricSeries> = {};
  let totalRecords = 0;
  for (const [id, points] of Object.entries(series)) {
    const samples = points.length * (perDay[id] ?? 1);
    totalRecords += samples;
    metrics[id] = { id, unit: units[id] ?? "", kind: kinds[id] ?? "avg", samples, points };
  }

  return {
    version: 1,
    createdAt: now.toISOString(),
    exportDate: end,
    fileName: "Demo data",
    demo: true,
    range: { start: addDays(end, -(N - 1)), end },
    totalRecords,
    metrics,
    sleep,
    activity,
    workouts,
    sources: [
      { name: "Apple Watch (demo)", kind: "watch", records: Math.round(totalRecords * 0.86) },
      { name: "iPhone (demo)", kind: "phone", records: Math.round(totalRecords * 0.14) },
    ],
    distanceUnit: "km",
  };
}
