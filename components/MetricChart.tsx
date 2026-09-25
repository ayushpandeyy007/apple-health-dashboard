"use client";

import type { ReactNode } from "react";
import { fmtBucket, fmtNum } from "@/lib/format";
import { metricInfo } from "@/lib/health/catalog";
import { chartRows, withDelta, type ChartRow, type Period } from "@/lib/health/series";
import type { HealthSummary } from "@/lib/health/types";
import { TrendBar, TrendLine } from "./charts";
import { ChartCard } from "./ui";

export const vsLabel = (period: Period) => (period.prev ? `vs prev ${period.label}` : undefined);

export function aggCaption(period: Period, how: "avg" | "latest" | "total", noun = "Daily average"): string {
  if (how === "latest") return "Most recent reading";
  if (how === "total") return "Total for the period";
  return period.gran === "day" ? noun : `${noun}, grouped by ${period.gran}`;
}

export function valueTable(rows: ChartRow[], period: Period, label: string, format: (v: number) => string) {
  return {
    columns: [
      { label: period.gran === "day" ? "Date" : period.gran === "week" ? "Week" : "Month", render: (r: ChartRow) => fmtBucket(r.key, period.gran) },
      { label, align: "right" as const, render: (r: ChartRow) => format(r.v as number) },
    ],
    rows: rows.filter((r) => typeof r.v === "number").reverse(),
  };
}

/** A chart card for any HealthKit metric in the summary. Renders nothing if the export lacks it. */
export function MetricChart(props: {
  summary: HealthSummary;
  period: Period;
  id: string;
  icon: ReactNode;
  color: string;
  chart?: "bar" | "line";
  how?: "avg" | "latest" | "total";
  title?: string;
  dots?: boolean;
  decimals?: number;
  className?: string;
}) {
  const series = props.summary.metrics[props.id];
  if (!series) return null;
  const info = metricInfo(props.id, series);
  const how = props.how ?? "avg";
  const decimals = props.decimals ?? info.decimals ?? 0;
  const { value, delta } = withDelta(series.points, props.period, how);
  const rows = chartRows(series.points, props.period, (p) => ({ v: p.v }));
  const format = (v: number) => `${fmtNum(v, decimals)}${info.unit ? ` ${info.unit}` : ""}`;
  const title = props.title ?? info.label;
  const chartProps = { rows, period: props.period, color: props.color, label: title, format };
  return (
    <ChartCard
      className={props.className}
      title={title}
      icon={props.icon}
      color={props.color}
      value={fmtNum(value, decimals)}
      unit={info.unit}
      caption={aggCaption(props.period, how)}
      delta={delta}
      better={info.better}
      deltaLabel={vsLabel(props.period)}
      empty={value === null}
      table={valueTable(rows, props.period, title, format)}
    >
      {props.chart === "bar" ? <TrendBar {...chartProps} /> : <TrendLine {...chartProps} dots={props.dots} />}
    </ChartCard>
  );
}
