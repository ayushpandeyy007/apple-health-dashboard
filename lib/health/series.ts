import type { DayPoint, HealthSummary } from "./types";

const DAY_MS = 86_400_000;

export const toDay = (iso: string) => Math.floor(Date.parse(iso) / DAY_MS);
export const fromDay = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => fromDay(toDay(iso) + n);

export type RangeKey = "7d" | "30d" | "90d" | "6m" | "1y" | "all";
export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "3M", days: 91 },
  { key: "6m", label: "6M", days: 182 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "All", days: null },
];

export type Granularity = "day" | "week" | "month";

export interface Period {
  start: string;
  end: string;
  days: number;
  gran: Granularity;
  prev?: { start: string; end: string };
  label: string;
}

/** The selected window, anchored to the last day in the export (not today). */
export function periodFor(summary: HealthSummary, key: RangeKey): Period {
  const end = summary.range.end;
  const preset = RANGES.find((r) => r.key === key) ?? RANGES[1];
  const days = preset.days ?? toDay(end) - toDay(summary.range.start) + 1;
  const start = addDays(end, -(days - 1));
  return {
    start,
    end,
    days,
    gran: days <= 92 ? "day" : days <= 400 ? "week" : "month",
    prev: preset.days ? { start: addDays(start, -days), end: addDays(start, -1) } : undefined,
    label: preset.label,
  };
}

export function within<T extends { d: string }>(rows: T[], start: string, end: string): T[] {
  return rows.filter((r) => r.d >= start && r.d <= end);
}

export function bucketKey(iso: string, gran: Granularity): string {
  if (gran === "day") return iso;
  if (gran === "month") return `${iso.slice(0, 7)}-01`;
  const day = toDay(iso);
  const weekday = (new Date(day * DAY_MS).getUTCDay() + 6) % 7; // Monday = 0
  return fromDay(day - weekday);
}

export type ChartRow = { key: string } & Record<string, number | null | string | [number, number]>;
type Agg = "avg" | "sum" | "min" | "max";

/**
 * Turn daily rows into evenly spaced chart rows (one per day/week/month) across
 * the period. Fields are averaged per bucket unless `agg` says otherwise;
 * buckets without data get null so gaps show honestly.
 */
export function chartRows<T extends { d: string }>(
  rows: T[],
  period: Period,
  pick: (row: T) => Record<string, number | undefined | null>,
  agg: Record<string, Agg> = {},
): ChartRow[] {
  const acc = new Map<string, Record<string, { s: number; n: number; mn: number; mx: number }>>();
  for (let day = toDay(period.start); day <= toDay(period.end); day++) {
    const k = bucketKey(fromDay(day), period.gran);
    if (!acc.has(k)) acc.set(k, {});
  }
  for (const row of within(rows, period.start, period.end)) {
    const bucket = acc.get(bucketKey(row.d, period.gran));
    if (!bucket) continue;
    for (const [field, v] of Object.entries(pick(row))) {
      if (v === undefined || v === null || Number.isNaN(v)) continue;
      const a = (bucket[field] ??= { s: 0, n: 0, mn: Infinity, mx: -Infinity });
      a.s += v;
      a.n++;
      a.mn = Math.min(a.mn, v);
      a.mx = Math.max(a.mx, v);
    }
  }
  const names = new Set<string>();
  for (const fields of acc.values()) for (const f of Object.keys(fields)) names.add(f);
  return [...acc.entries()].map(([key, fields]) => {
    const out: ChartRow = { key };
    for (const field of names) {
      const a = fields[field];
      const mode = agg[field] ?? "avg";
      out[field] = !a ? null : mode === "sum" ? a.s : mode === "min" ? a.mn : mode === "max" ? a.mx : a.s / a.n;
    }
    return out;
  });
}

export const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function metricPoints(summary: HealthSummary, id: string): DayPoint[] {
  return summary.metrics[id]?.points ?? [];
}

/** Average (or latest / total) of a daily series over a window. */
export function summarize(
  points: { d: string; v: number }[],
  start: string,
  end: string,
  how: "avg" | "latest" | "total" = "avg",
): number | null {
  const rows = within(points, start, end);
  if (!rows.length) return null;
  if (how === "latest") return rows[rows.length - 1].v;
  const total = rows.reduce((a, r) => a + r.v, 0);
  return how === "total" ? total : total / rows.length;
}

/** Current value and % change vs the previous window of the same length. */
export function withDelta(
  points: { d: string; v: number }[],
  period: Period,
  how: "avg" | "latest" | "total" = "avg",
): { value: number | null; delta: number | null } {
  const value = summarize(points, period.start, period.end, how);
  const prev = period.prev ? summarize(points, period.prev.start, period.prev.end, how) : null;
  const delta = value !== null && prev ? ((value - prev) / Math.abs(prev)) * 100 : null;
  return { value, delta };
}

/** Last N days (ending at `end`) as sparkline values. */
export function sparkValues(points: { d: string; v: number }[], period: Period, maxPoints = 24): number[] {
  const rows = chartRows(points, period, (p) => ({ v: p.v }));
  const values = rows.map((r) => r.v).filter((v): v is number => typeof v === "number");
  return values.slice(-maxPoints);
}
