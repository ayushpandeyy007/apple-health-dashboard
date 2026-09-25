/** How a metric's samples are rolled up into one value per day. */
export type AggKind = "sum" | "avg" | "count" | "duration";

/** One day of one metric. Dates are local calendar days: "YYYY-MM-DD". */
export interface DayPoint {
  d: string;
  /** Daily total (sum/count/duration kinds) or daily mean (avg kind). */
  v: number;
  min?: number;
  max?: number;
}

export interface MetricSeries {
  /** HealthKit identifier, e.g. "HKQuantityTypeIdentifierStepCount". */
  id: string;
  /** Unit as exported by the Health app (already in the user's preferred units). */
  unit: string;
  kind: AggKind;
  /** Number of raw samples in the export. */
  samples: number;
  points: DayPoint[];
}

/** One night of sleep, keyed by the date you woke up. Durations in minutes. */
export interface SleepNight {
  d: string;
  asleep: number;
  inBed?: number;
  awake: number;
  rem: number;
  core: number;
  deep: number;
  /** "Asleep" samples without stage data (older watchOS, third-party apps). */
  unspecified: number;
  /** Bedtime / wake time as minutes from local midnight of `d` (bedtime is usually negative). */
  start?: number;
  end?: number;
  source: string;
}

/** Apple Watch activity rings for one day. Energy in kcal. */
export interface ActivityDay {
  d: string;
  move: number;
  moveGoal: number;
  exercise: number;
  exerciseGoal: number;
  stand: number;
  standGoal: number;
}

export interface Workout {
  /** Friendly activity name, e.g. "Running". */
  type: string;
  /** Local date "YYYY-MM-DD" and local start time "HH:MM". */
  d: string;
  time: string;
  /** Minutes. */
  duration: number;
  /** Kilometres (normalised; displayed in the user's preferred unit). */
  distanceKm?: number;
  /** Kilocalories. */
  energy?: number;
  avgHr?: number;
  maxHr?: number;
  source: string;
}

export type SourceKind = "watch" | "phone" | "other";

export interface SourceInfo {
  name: string;
  kind: SourceKind;
  records: number;
}

export interface HealthSummary {
  version: 1;
  /** ISO timestamp of when the file was processed. */
  createdAt: string;
  /** "YYYY-MM-DD" date the export was made on the iPhone, if present. */
  exportDate?: string;
  fileName?: string;
  demo?: boolean;
  /** First and last day with any data. */
  range: { start: string; end: string };
  totalRecords: number;
  metrics: Record<string, MetricSeries>;
  sleep: SleepNight[];
  activity: ActivityDay[];
  workouts: Workout[];
  sources: SourceInfo[];
  /** Distance unit the user prefers in the Health app. */
  distanceUnit: "km" | "mi";
}

/** Messages the parser worker posts back to the page. */
export type WorkerMessage =
  | { type: "progress"; loaded: number; total: number; records: number }
  | { type: "done"; summary: HealthSummary }
  | { type: "error"; message: string };
