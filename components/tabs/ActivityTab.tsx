"use client";

import { Building2, Flame, Footprints, PersonStanding, Route, Sun, Timer } from "lucide-react";
import { ringProgress } from "@/components/ActivityRings";
import { TrendBar } from "@/components/charts";
import { MetricChart, aggCaption, valueTable, vsLabel } from "@/components/MetricChart";
import { RingsCard } from "@/components/tabs/OverviewTab";
import { Card, ChartCard, StatTile } from "@/components/ui";
import { fmtNum } from "@/lib/format";
import { ID, metricInfo } from "@/lib/health/catalog";
import { chartRows, metricPoints, sparkValues, within, withDelta, type Period } from "@/lib/health/series";
import type { ActivityDay, HealthSummary } from "@/lib/health/types";

function ringCard(
  activity: ActivityDay[],
  period: Period,
  key: "move" | "exercise" | "stand",
  goal: "moveGoal" | "exerciseGoal" | "standGoal",
  props: { title: string; unit: string; color: string; icon: React.ReactNode },
) {
  const pts = activity.map((a) => ({ d: a.d, v: a[key] }));
  const { value, delta } = withDelta(pts, period);
  const rows = chartRows(activity, period, (a) => ({ v: a[key], goal: a[goal] }));
  const format = (v: number) => `${fmtNum(v)} ${props.unit}`;
  return (
    <ChartCard
      title={props.title}
      icon={props.icon}
      color={props.color}
      value={fmtNum(value)}
      unit={props.unit}
      caption={aggCaption(period, "avg")}
      delta={delta}
      better="up"
      deltaLabel={vsLabel(period)}
      empty={value === null}
      legend={[
        { label: props.title, color: props.color },
        { label: "Goal", color: "var(--text-2)", shape: "dash" },
      ]}
      table={valueTable(rows, period, props.title, format)}
    >
      <TrendBar rows={rows} period={period} color={props.color} label={props.title} format={format} goalKey="goal" />
    </ChartCard>
  );
}

export function ActivityTab({ summary, period }: { summary: HealthSummary; period: Period }) {
  const vs = vsLabel(period);
  const days = within(summary.activity, period.start, period.end);
  const closed = [0, 1, 2].map((i) => days.filter((d) => ringProgress(d)[i] >= 1).length);
  let streak = 0;
  for (let i = summary.activity.length - 1; i >= 0 && summary.activity[i].d <= period.end; i--) {
    if (ringProgress(summary.activity[i])[0] >= 1) streak++;
    else break;
  }
  const tile = (id: string) => {
    const pts = metricPoints(summary, id);
    return { ...withDelta(pts, period), spark: sparkValues(pts, period), info: metricInfo(id, summary.metrics[id]) };
  };
  const steps = tile(ID.steps);
  const distance = tile(ID.distance);
  const flights = tile(ID.flights);
  const standPts = summary.activity.map((a) => ({ d: a.d, v: a.stand }));
  const stand = { ...withDelta(standPts, period), spark: sparkValues(standPts, period) };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <RingsCard summary={summary} period={period} />
        <Card className="lg:col-span-2">
          <div className="text-[13px] font-medium text-ink-2">Ring goals closed</div>
          <p className="mt-0.5 text-xs text-ink-3">{days.length} days with ring data in this period</p>
          <div className="mt-5 space-y-4">
            {[
              { label: "Move", color: "var(--c-move)", n: closed[0] },
              { label: "Exercise", color: "var(--c-exercise)", n: closed[1] },
              { label: "Stand", color: "var(--c-stand)", n: closed[2] },
            ].map((r) => {
              const pct = days.length ? (r.n / days.length) * 100 : 0;
              return (
                <div key={r.label}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="font-medium">{r.label}</span>
                    <span className="tabular text-ink-2">
                      <span className="font-semibold text-ink">{fmtNum(pct)}%</span> · {r.n} of {days.length} days
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${r.color} 18%, transparent)` }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-4 text-sm">
            <div>
              <div className="text-xs text-ink-2">Current Move streak</div>
              <div className="text-xl font-semibold">{streak} <span className="text-sm font-normal text-ink-2">days</span></div>
            </div>
            <div>
              <div className="text-xs text-ink-2">Perfect days (all 3 rings)</div>
              <div className="text-xl font-semibold">
                {days.filter((d) => ringProgress(d).every((p) => p >= 1)).length} <span className="text-sm font-normal text-ink-2">days</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Steps" icon={<Footprints />} color="var(--c-activity)" value={fmtNum(steps.value)} unit="/ day" delta={steps.delta} better="up" deltaLabel={vs} spark={steps.spark} />
        <StatTile label="Distance" icon={<Route />} color="var(--c-activity)" value={fmtNum(distance.value, 1)} unit={`${distance.info.unit} / day`} delta={distance.delta} better="up" deltaLabel={vs} spark={distance.spark} />
        <StatTile label="Flights climbed" icon={<Building2 />} color="var(--c-activity)" value={fmtNum(flights.value)} unit="/ day" delta={flights.delta} better="up" deltaLabel={vs} spark={flights.spark} />
        <StatTile label="Stand hours" icon={<PersonStanding />} color="var(--c-stand)" value={fmtNum(stand.value, 1)} unit="hr / day" delta={stand.delta} better="up" deltaLabel={vs} spark={stand.spark} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {ringCard(summary.activity, period, "move", "moveGoal", { title: "Active energy", unit: "kcal", color: "var(--c-move)", icon: <Flame /> })}
        {ringCard(summary.activity, period, "exercise", "exerciseGoal", { title: "Exercise", unit: "min", color: "var(--c-exercise)", icon: <Timer /> })}
        {ringCard(summary.activity, period, "stand", "standGoal", { title: "Stand hours", unit: "hr", color: "var(--c-stand)", icon: <PersonStanding /> })}
        <MetricChart summary={summary} period={period} id={ID.steps} chart="bar" icon={<Footprints />} color="var(--c-activity)" />
        <MetricChart summary={summary} period={period} id={ID.distance} chart="bar" icon={<Route />} color="var(--c-activity)" decimals={1} />
        <MetricChart summary={summary} period={period} id={ID.flights} chart="bar" icon={<Building2 />} color="var(--c-activity)" />
        <MetricChart summary={summary} period={period} id={ID.daylight} chart="bar" icon={<Sun />} color="var(--c-hearing)" />
      </div>
    </div>
  );
}
