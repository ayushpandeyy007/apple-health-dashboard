"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { fmtAxis, fmtBucket, fmtClock, fmtCompact, fmtDuration } from "@/lib/format";
import type { ChartRow, Period } from "@/lib/health/series";

const tick = { fill: "var(--text-3)", fontSize: 11 };
const margin = { top: 6, right: 6, bottom: 0, left: 0 };

const xAxis = (period: Period) => (
  <XAxis
    dataKey="key"
    tickFormatter={(k: string) => fmtAxis(k, period.gran, period.days)}
    tick={tick}
    tickLine={false}
    axisLine={{ stroke: "var(--axis)" }}
    minTickGap={20}
    interval="preserveStartEnd"
  />
);

const yAxis = (format: (v: number) => string = fmtCompact, extra: Record<string, unknown> = {}) => (
  <YAxis width={42} tick={tick} tickLine={false} axisLine={false} tickFormatter={format} tickCount={4} {...extra} />
);

const grid = <CartesianGrid vertical={false} stroke="var(--grid)" />;

export interface TipItem {
  label: string;
  color: string;
  value: (row: ChartRow) => number | null | undefined;
  format: (v: number) => string;
  shape?: "line" | "dash";
}

function ChartTooltip({ active, payload, label, period, items }: Partial<TooltipContentProps> & { period: Period; items: TipItem[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartRow;
  const lines = items
    .map((it) => ({ it, v: it.value(row) }))
    .filter((x): x is { it: TipItem; v: number } => x.v !== null && x.v !== undefined && !Number.isNaN(x.v));
  if (!lines.length) return null;
  return (
    <div className="min-w-36 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1.5 text-ink-2">{fmtBucket(String(label ?? row.key), period.gran)}</div>
      {lines.map(({ it, v }) => (
        <div key={it.label} className="flex items-center gap-2 py-0.5">
          <span
            className="h-0 w-3 shrink-0 border-t-2"
            style={{ borderColor: it.color, borderStyle: it.shape === "dash" ? "dashed" : "solid" }}
          />
          <span className="font-semibold text-ink tabular">{it.format(v)}</span>
          <span className="text-ink-2">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

const num = (key: string) => (row: ChartRow) => row[key] as number | null;

/** Bars per day/week/month, optionally with a dashed goal line. */
export function TrendBar(props: {
  rows: ChartRow[];
  period: Period;
  color: string;
  label: string;
  format: (v: number) => string;
  dataKey?: string;
  goalKey?: string;
  height?: number;
}) {
  const key = props.dataKey ?? "v";
  const items: TipItem[] = [{ label: props.label, color: props.color, value: num(key), format: props.format }];
  if (props.goalKey) items.push({ label: "Goal", color: "var(--text-2)", value: num(props.goalKey), format: props.format, shape: "dash" });
  return (
    <ResponsiveContainer width="100%" height={props.height ?? 200}>
      <ComposedChart data={props.rows} margin={margin} barCategoryGap="22%">
        {grid}
        {xAxis(props.period)}
        {yAxis()}
        <Tooltip cursor={{ fill: "var(--hover)" }} content={(p) => <ChartTooltip {...p} period={props.period} items={items} />} />
        <Bar dataKey={key} fill={props.color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        {props.goalKey && (
          <Line
            dataKey={props.goalKey}
            type="stepAfter"
            stroke="var(--text-2)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Single trend line with a soft wash; dots for sparse series like VO₂ max. */
export function TrendLine(props: {
  rows: ChartRow[];
  period: Period;
  color: string;
  label: string;
  format: (v: number) => string;
  dataKey?: string;
  dots?: boolean;
  baseline?: number;
  height?: number;
}) {
  const key = props.dataKey ?? "v";
  const values = props.rows.map((r) => r[key]).filter((v): v is number => typeof v === "number");
  const domain = niceDomain(props.baseline !== undefined ? [...values, props.baseline] : values);
  const items: TipItem[] = [{ label: props.label, color: props.color, value: num(key), format: props.format }];
  return (
    <ResponsiveContainer width="100%" height={props.height ?? 200}>
      <ComposedChart data={props.rows} margin={margin}>
        {grid}
        {xAxis(props.period)}
        {yAxis(axisNumber(domain), { domain, allowDecimals: domain[1] - domain[0] < 8 })}
        <Tooltip cursor={{ stroke: "var(--axis)", strokeWidth: 1 }} content={(p) => <ChartTooltip {...p} period={props.period} items={items} />} />
        {props.baseline !== undefined && <ReferenceLine y={props.baseline} stroke="var(--axis)" strokeWidth={1} />}
        <Area dataKey={key} type="monotone" stroke="none" fill={props.color} fillOpacity={0.08} connectNulls isAnimationActive={false} baseValue={domain[0]} />
        <Line
          dataKey={key}
          type="monotone"
          stroke={props.color}
          strokeWidth={2}
          connectNulls
          dot={props.dots ? { r: 4, fill: props.color, stroke: "var(--surface)", strokeWidth: 2 } : false}
          activeDot={{ r: 5, fill: props.color, stroke: "var(--surface)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Daily low-high range as floating bars with the average as a line (heart rate). */
export function RangeChart(props: { rows: ChartRow[]; period: Period; color: string; unit: string; height?: number }) {
  const rows = props.rows.map((r) => ({
    ...r,
    range: typeof r.min === "number" && typeof r.max === "number" ? ([r.min, r.max] as [number, number]) : null,
  }));
  const values = rows.flatMap((r) => r.range ?? []);
  const fmt = (v: number) => `${Math.round(v)} ${props.unit}`;
  const items: TipItem[] = [
    { label: "Average", color: props.color, value: num("v"), format: fmt },
    { label: "Highest", color: props.color, value: num("max"), format: fmt, shape: "dash" },
    { label: "Lowest", color: props.color, value: num("min"), format: fmt, shape: "dash" },
  ];
  return (
    <ResponsiveContainer width="100%" height={props.height ?? 220}>
      <ComposedChart data={rows} margin={margin} barCategoryGap="30%">
        {grid}
        {xAxis(props.period)}
        {yAxis((v) => String(Math.round(v)), { domain: niceDomain(values) })}
        <Tooltip cursor={{ fill: "var(--hover)" }} content={(p) => <ChartTooltip {...p} period={props.period} items={items} />} />
        <Bar dataKey="range" fill={props.color} fillOpacity={0.28} radius={4} maxBarSize={12} isAnimationActive={false} />
        <Line dataKey="v" type="monotone" stroke={props.color} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4, fill: props.color, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export const STAGES = [
  { key: "deep", label: "Deep", color: "var(--c-deep)" },
  { key: "core", label: "Core", color: "var(--c-core)" },
  { key: "rem", label: "REM", color: "var(--c-rem)" },
  { key: "unspecified", label: "Asleep (no stages)", color: "var(--c-unspec)" },
  { key: "awake", label: "Awake", color: "var(--c-awake)" },
] as const;

/** Stacked sleep stages per night, rounded only on the top-most segment. */
export function SleepStagesChart({ rows, period, height }: { rows: ChartRow[]; period: Period; height?: number }) {
  const withTop = rows.map((r) => ({ ...r, top: [...STAGES].reverse().find((s) => ((r[s.key] as number | null) ?? 0) > 0)?.key ?? "" }));
  const items: TipItem[] = [...STAGES]
    .reverse()
    .map((s) => ({ label: s.label, color: s.color, value: (row: ChartRow) => ((row[s.key] as number) > 0 ? (row[s.key] as number) : null), format: (v: number) => fmtDuration(v * 60) }));
  return (
    <ResponsiveContainer width="100%" height={height ?? 240}>
      <BarChart data={withTop} margin={margin} barCategoryGap="22%">
        {grid}
        {xAxis(period)}
        {yAxis((v) => `${v}h`, { allowDecimals: false })}
        <Tooltip cursor={{ fill: "var(--hover)" }} content={(p) => <ChartTooltip {...p} period={period} items={items} />} />
        {STAGES.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="sleep"
            fill={s.color}
            stroke="var(--surface)"
            strokeWidth={1}
            maxBarSize={24}
            isAnimationActive={false}
            shape={(p: unknown) => {
              const props = p as { payload?: { top?: string } } & Record<string, unknown>;
              return <Rectangle {...props} radius={props.payload?.top === s.key ? [4, 4, 0, 0] : 0} />;
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Bedtime-to-wake span per night on an inverted clock axis. */
export function SleepScheduleChart({ rows, period, height }: { rows: ChartRow[]; period: Period; height?: number }) {
  const data = rows.map((r) => ({ ...r, span: typeof r.start === "number" && typeof r.end === "number" ? [r.start, r.end] : null }));
  const starts = rows.map((r) => r.start).filter((v): v is number => typeof v === "number");
  const ends = rows.map((r) => r.end).filter((v): v is number => typeof v === "number");
  const lo = Math.floor((Math.min(...starts, -60) - 30) / 120) * 120;
  const hi = Math.ceil((Math.max(...ends, 420) + 30) / 120) * 120;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += 120) ticks.push(t);
  const items: TipItem[] = [
    { label: "Fell asleep", color: "var(--c-core)", value: num("start"), format: fmtClock },
    { label: "Woke up", color: "var(--c-core)", value: num("end"), format: fmtClock },
  ];
  return (
    <ResponsiveContainer width="100%" height={height ?? 240}>
      <BarChart data={data} margin={margin} barCategoryGap="30%">
        {grid}
        {xAxis(period)}
        {yAxis(fmtClock, { reversed: true, domain: [lo, hi], ticks, width: 64 })}
        <Tooltip cursor={{ fill: "var(--hover)" }} content={(p) => <ChartTooltip {...p} period={period} items={items} />} />
        <Bar dataKey="span" fill="var(--c-core)" radius={4} maxBarSize={14} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Axis ticks show bare numbers - the unit is in the card header. */
const axisNumber = ([lo, hi]: [number, number]) => (v: number) =>
  hi - lo < 5 ? v.toFixed(hi - lo < 0.5 ? 2 : 1) : fmtCompact(v);

function niceDomain(values: number[]): [number, number] {
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || Math.abs(max) * 0.05 || 1;
  const step = niceStep((max - min + 2 * pad) / 4);
  return [Math.floor((min - pad) / step) * step, Math.ceil((max + pad) / step) * step];
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
