import type { Granularity } from "./health/series";

const numberFormats = new Map<string, Intl.NumberFormat>();
function nf(decimals: number, compact = false): Intl.NumberFormat {
  const key = `${decimals}-${compact}`;
  let f = numberFormats.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, compact
      ? { notation: "compact", maximumFractionDigits: 1 }
      : { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
    numberFormats.set(key, f);
  }
  return f;
}

export function fmtNum(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return nf(decimals).format(v);
}

export function fmtCompact(v: number): string {
  return Math.abs(v) >= 10_000 ? nf(0, true).format(v) : nf(Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0).format(v);
}

/** 432 -> "7h 12m" */
export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "—";
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
/** Minutes relative to midnight (may be negative or > 1440) -> "11:15 PM". */
export function fmtClock(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "—";
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return clock.format(new Date(m * 60_000));
}

const dateFormats = {
  weekday: new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }),
  short: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }),
  medium: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
  long: new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
  month: new Intl.DateTimeFormat(undefined, { month: "short", timeZone: "UTC" }),
  monthYear: new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }),
};

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function fmtDate(iso: string | undefined, style: keyof typeof dateFormats = "medium"): string {
  return iso ? dateFormats[style].format(asDate(iso)) : "—";
}

export function fmtAxis(key: string, gran: Granularity, days: number): string {
  if (gran === "month") return `${dateFormats.month.format(asDate(key))} ’${key.slice(2, 4)}`;
  if (gran === "day" && days <= 7) return dateFormats.weekday.format(asDate(key));
  return dateFormats.short.format(asDate(key));
}

export function fmtBucket(key: string, gran: Granularity): string {
  if (gran === "month") return dateFormats.monthYear.format(asDate(key));
  if (gran === "week") return `Week of ${dateFormats.medium.format(asDate(key))}`;
  return dateFormats.long.format(asDate(key));
}

export const kmTo = (km: number, unit: "km" | "mi") => (unit === "mi" ? km / 1.609344 : km);
