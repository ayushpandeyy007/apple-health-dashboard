import type { MetricSeries } from "./types";

const Q = "HKQuantityTypeIdentifier";
const C = "HKCategoryTypeIdentifier";

/** HealthKit identifiers the curated dashboard reads directly. */
export const ID = {
  steps: `${Q}StepCount`,
  distance: `${Q}DistanceWalkingRunning`,
  flights: `${Q}FlightsClimbed`,
  activeEnergy: `${Q}ActiveEnergyBurned`,
  exercise: `${Q}AppleExerciseTime`,
  standHour: `${C}AppleStandHour`,
  daylight: `${Q}TimeInDaylight`,
  heartRate: `${Q}HeartRate`,
  restingHr: `${Q}RestingHeartRate`,
  walkingHr: `${Q}WalkingHeartRateAverage`,
  hrv: `${Q}HeartRateVariabilitySDNN`,
  vo2max: `${Q}VO2Max`,
  recovery: `${Q}HeartRateRecoveryOneMinute`,
  spo2: `${Q}OxygenSaturation`,
  respRate: `${Q}RespiratoryRate`,
  wristTemp: `${Q}AppleSleepingWristTemperature`,
  breathing: `${Q}AppleSleepingBreathingDisturbances`,
  noise: `${Q}EnvironmentalAudioExposure`,
  headphone: `${Q}HeadphoneAudioExposure`,
  weight: `${Q}BodyMass`,
  mindful: `${C}MindfulSession`,
  highHr: `${C}HighHeartRateEvent`,
  lowHr: `${C}LowHeartRateEvent`,
  irregular: `${C}IrregularHeartRhythmEvent`,
} as const;

export type Category =
  | "activity" | "heart" | "respiratory" | "sleep" | "body" | "hearing"
  | "mobility" | "mindfulness" | "nutrition" | "vitals" | "other";

export const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: "activity", label: "Activity", color: "var(--c-activity)" },
  { key: "heart", label: "Heart", color: "var(--c-heart)" },
  { key: "respiratory", label: "Respiratory", color: "var(--c-resp)" },
  { key: "sleep", label: "Sleep", color: "var(--c-core)" },
  { key: "mobility", label: "Mobility", color: "var(--c-activity)" },
  { key: "hearing", label: "Hearing", color: "var(--c-hearing)" },
  { key: "body", label: "Body measurements", color: "var(--c-body)" },
  { key: "vitals", label: "Vitals", color: "var(--c-heart)" },
  { key: "mindfulness", label: "Mindfulness", color: "var(--c-mindful)" },
  { key: "nutrition", label: "Nutrition", color: "var(--c-exercise)" },
  { key: "other", label: "Other data", color: "var(--c-resp)" },
];

export const categoryColor = (c: Category) => CATEGORIES.find((x) => x.key === c)?.color ?? "var(--c-resp)";

export interface MetricInfo {
  label: string;
  category: Category;
  /** Display unit; overrides the exported unit (e.g. "count/min" -> "bpm"). */
  unit?: string;
  decimals?: number;
  /** Which direction is an improvement - drives delta colors. */
  better?: "up" | "down";
}

const M = (label: string, category: Category, extra: Partial<MetricInfo> = {}): MetricInfo => ({ label, category, ...extra });

const KNOWN: Record<string, MetricInfo> = {
  // Activity
  [ID.steps]: M("Steps", "activity", { unit: "steps", better: "up" }),
  [ID.distance]: M("Walking + running distance", "activity", { decimals: 2, better: "up" }),
  [`${Q}DistanceCycling`]: M("Cycling distance", "activity", { decimals: 1, better: "up" }),
  [`${Q}DistanceSwimming`]: M("Swimming distance", "activity", { better: "up" }),
  [`${Q}DistanceWheelchair`]: M("Wheelchair distance", "activity", { decimals: 2, better: "up" }),
  [`${Q}DistanceDownhillSnowSports`]: M("Downhill snow sports distance", "activity", { decimals: 1 }),
  [ID.activeEnergy]: M("Active energy", "activity", { better: "up" }),
  [`${Q}BasalEnergyBurned`]: M("Resting energy", "activity"),
  [ID.flights]: M("Flights climbed", "activity", { unit: "floors", better: "up" }),
  [ID.exercise]: M("Exercise minutes", "activity", { unit: "min", better: "up" }),
  [`${Q}AppleStandTime`]: M("Stand minutes", "activity", { unit: "min", better: "up" }),
  [`${Q}AppleMoveTime`]: M("Move minutes", "activity", { unit: "min", better: "up" }),
  [ID.standHour]: M("Stand hours", "activity", { unit: "hr", better: "up" }),
  [ID.daylight]: M("Time in daylight", "activity", { unit: "min", better: "up" }),
  [`${Q}PhysicalEffort`]: M("Physical effort", "activity", { unit: "METs", decimals: 1 }),
  [`${Q}PushCount`]: M("Wheelchair pushes", "activity", { unit: "pushes" }),
  [`${Q}SwimmingStrokeCount`]: M("Swimming strokes", "activity", { unit: "strokes" }),
  [`${Q}RunningSpeed`]: M("Running speed", "mobility", { decimals: 1, better: "up" }),
  [`${Q}RunningPower`]: M("Running power", "mobility"),
  [`${Q}RunningStrideLength`]: M("Running stride length", "mobility", { decimals: 2 }),
  [`${Q}RunningVerticalOscillation`]: M("Vertical oscillation", "mobility", { decimals: 1, better: "down" }),
  [`${Q}RunningGroundContactTime`]: M("Ground contact time", "mobility", { better: "down" }),
  [`${Q}CyclingSpeed`]: M("Cycling speed", "activity", { decimals: 1 }),
  [`${Q}CyclingPower`]: M("Cycling power", "activity"),
  [`${Q}CyclingCadence`]: M("Cycling cadence", "activity", { unit: "rpm" }),
  // Heart
  [ID.heartRate]: M("Heart rate", "heart", { unit: "bpm" }),
  [ID.restingHr]: M("Resting heart rate", "heart", { unit: "bpm", better: "down" }),
  [ID.walkingHr]: M("Walking heart rate average", "heart", { unit: "bpm", better: "down" }),
  [ID.hrv]: M("Heart rate variability", "heart", { unit: "ms", better: "up" }),
  [ID.vo2max]: M("Cardio fitness (VO₂ max)", "heart", { unit: "mL/kg·min", decimals: 1, better: "up" }),
  [ID.recovery]: M("Cardio recovery", "heart", { unit: "bpm", better: "up" }),
  [`${Q}AtrialFibrillationBurden`]: M("AFib history", "heart", { decimals: 1, better: "down" }),
  [`${Q}PeripheralPerfusionIndex`]: M("Perfusion index", "heart", { decimals: 1 }),
  [ID.highHr]: M("High heart rate notifications", "heart", { unit: "alerts" }),
  [ID.lowHr]: M("Low heart rate notifications", "heart", { unit: "alerts" }),
  [ID.irregular]: M("Irregular rhythm notifications", "heart", { unit: "alerts" }),
  [`${C}LowCardioFitnessEvent`]: M("Low cardio fitness notifications", "heart", { unit: "alerts" }),
  // Respiratory
  [ID.spo2]: M("Blood oxygen", "respiratory", { decimals: 1, better: "up" }),
  [ID.respRate]: M("Respiratory rate", "respiratory", { unit: "br/min", decimals: 1 }),
  [`${Q}ForcedVitalCapacity`]: M("Forced vital capacity", "respiratory", { decimals: 2 }),
  [`${Q}PeakExpiratoryFlowRate`]: M("Peak expiratory flow", "respiratory"),
  // Sleep
  [ID.wristTemp]: M("Wrist temperature (sleeping)", "sleep", { decimals: 2 }),
  [ID.breathing]: M("Breathing disturbances", "sleep", { decimals: 1, better: "down" }),
  [`${C}SleepApneaEvent`]: M("Sleep apnea notifications", "sleep", { unit: "alerts" }),
  // Hearing
  [ID.noise]: M("Environmental sound levels", "hearing", { unit: "dB", better: "down" }),
  [ID.headphone]: M("Headphone audio levels", "hearing", { unit: "dB", better: "down" }),
  [`${Q}EnvironmentalSoundReduction`]: M("Environmental sound reduction", "hearing", { unit: "dB" }),
  [`${C}AudioExposureEvent`]: M("Noise notifications", "hearing", { unit: "alerts" }),
  [`${C}HeadphoneAudioExposureEvent`]: M("Headphone notifications", "hearing", { unit: "alerts" }),
  // Mobility
  [`${Q}WalkingSpeed`]: M("Walking speed", "mobility", { decimals: 1, better: "up" }),
  [`${Q}WalkingStepLength`]: M("Walking step length", "mobility", { decimals: 1, better: "up" }),
  [`${Q}WalkingDoubleSupportPercentage`]: M("Double support time", "mobility", { decimals: 1, better: "down" }),
  [`${Q}WalkingAsymmetryPercentage`]: M("Walking asymmetry", "mobility", { decimals: 1, better: "down" }),
  [`${Q}AppleWalkingSteadiness`]: M("Walking steadiness", "mobility", { decimals: 0, better: "up" }),
  [`${Q}SixMinuteWalkTestDistance`]: M("Six-minute walk", "mobility", { better: "up" }),
  [`${Q}StairAscentSpeed`]: M("Stair speed: up", "mobility", { decimals: 2, better: "up" }),
  [`${Q}StairDescentSpeed`]: M("Stair speed: down", "mobility", { decimals: 2, better: "up" }),
  [`${C}AppleWalkingSteadinessEvent`]: M("Walking steadiness notifications", "mobility", { unit: "alerts" }),
  // Body
  [ID.weight]: M("Weight", "body", { decimals: 1 }),
  [`${Q}BodyMassIndex`]: M("Body mass index", "body", { unit: "BMI", decimals: 1 }),
  [`${Q}BodyFatPercentage`]: M("Body fat percentage", "body", { decimals: 1 }),
  [`${Q}LeanBodyMass`]: M("Lean body mass", "body", { decimals: 1 }),
  [`${Q}Height`]: M("Height", "body", { decimals: 1 }),
  [`${Q}WaistCircumference`]: M("Waist circumference", "body", { decimals: 1 }),
  [`${Q}BodyTemperature`]: M("Body temperature", "vitals", { decimals: 1 }),
  [`${Q}BasalBodyTemperature`]: M("Basal body temperature", "vitals", { decimals: 2 }),
  [`${Q}BloodPressureSystolic`]: M("Blood pressure (systolic)", "vitals", { better: "down" }),
  [`${Q}BloodPressureDiastolic`]: M("Blood pressure (diastolic)", "vitals", { better: "down" }),
  [`${Q}BloodGlucose`]: M("Blood glucose", "vitals", { decimals: 1 }),
  // Mindfulness & more
  [ID.mindful]: M("Mindful minutes", "mindfulness", { unit: "min", better: "up" }),
  [`${C}HandwashingEvent`]: M("Handwashing", "mindfulness", { unit: "times" }),
  [`${C}ToothbrushingEvent`]: M("Toothbrushing", "mindfulness", { unit: "times" }),
  [`${Q}UVExposure`]: M("UV index", "other", { decimals: 1 }),
  [`${Q}UnderwaterDepth`]: M("Underwater depth", "other", { decimals: 1 }),
  [`${Q}WaterTemperature`]: M("Water temperature", "other", { decimals: 1 }),
  [`${Q}NumberOfTimesFallen`]: M("Falls", "other", { unit: "falls" }),
  ["HKDataTypeSleepDurationGoal"]: M("Sleep goal", "sleep", { unit: "hr", decimals: 1 }),
};

const UNIT_LABELS: Record<string, string> = {
  "count/min": "bpm",
  "mL/min·kg": "mL/kg·min",
  degC: "°C",
  degF: "°F",
  "km/hr": "km/h",
  "mi/hr": "mph",
  "m/s": "m/s",
  "ft/s": "ft/s",
  "kcal/hr·kg": "METs",
  count: "",
};

export function unitLabel(unit: string): string {
  if (unit.startsWith("mmol<")) return "mmol/L";
  return UNIT_LABELS[unit] ?? unit;
}

/** Friendly name, category and display rules for any HealthKit identifier. */
export function metricInfo(id: string, series?: MetricSeries): MetricInfo & { unit: string } {
  const known = KNOWN[id];
  const rawUnit = series ? unitLabel(series.unit) : "";
  if (known) return { ...known, unit: known.unit ?? rawUnit };
  const name = id
    .replace(/^HK(Quantity|Category)TypeIdentifier|^HKDataType/, "")
    .replace(/^Apple(?=[A-Z])/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  const dietary = name.startsWith("Dietary ");
  const label = (dietary ? name.slice(8) : name).toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  const unit = series?.kind === "count" ? "times" : rawUnit;
  return { label, category: dietary ? "nutrition" : "other", unit, decimals: series?.kind === "avg" ? 1 : 0 };
}
