"use client";

import { Activity, Flame, Footprints, HeartPulse, Moon, Timer, Waves } from "lucide-react";
import { ActivityRings } from "@/components/ActivityRings";
import { SleepStagesChart, STAGES } from "@/components/charts";
import { MetricChart, vsLabel } from "@/components/MetricChart";
import { Card, ChartCard, StatTile } from "@/components/ui";
import { WorkoutList } from "@/components/tabs/WorkoutsTab";
import { fmtDate, fmtDuration, fmtNum } from "@/lib/format";
import { ID } from "@/lib/health/catalog";
import { addDays, chartRows, metricPoints, sparkValues, within, withDelta, type Period } from "@/lib/health/series";
import type { HealthSummary } from "@/lib/health/types";

export function RingsCard({ summary, period }: { summary: HealthSummary; period: Period }) {
  const days = within(summary.activity, "0000", period.end);
  const day = days[days.length - 1];
  const week = Array.from({ length: 7 }, (_, i) => addDays(period.end, i - 6)).map((d) => ({
    d,
    a: summary.activity.find((x) => x.d === d),
  }));
  const rows = day
    ? [
        { label: "Move", color: "var(--c-move)", value: `${fmtNum(day.move)}/${fmtNum(day.moveGoal)}`, unit: "kcal" },
        { label: "Exercise", color: "var(--c-exercise)", value: `${fmtNum(day.exercise)}/${fmtNum(day.exerciseGoal)}`, unit: "min" },
        { label: "Stand", color: "var(--c-stand)", value: `${fmtNum(day.stand)}/${fmtNum(day.standGoal)}`, unit: "hr" },
      ]
    : [];
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between text-[13px] font-medium text-ink-2">
        <span>Activity rings</span>
        <span className="text-xs font-normal text-ink-3">{day ? fmtDate(day.d, "long") : "No ring data"}</span>
      </div>
      <div className="mt-4 flex flex-1 items-center gap-6">
        <ActivityRings day={day} size={132} />
        <dl className="space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="flex items-center gap-1.5 text-xs text-ink-2">
                <span className="size-2 rounded-full" style={{ background: r.color }} />
                {r.label}
              </dt>
              <dd className="text-lg font-semibold leading-tight tabular">
                {r.value} <span className="text-xs font-normal text-ink-2">{r.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-1 border-t border-line pt-4">
        {week.map(({ d, a }) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <ActivityRings day={a} size={34} />
            <span className="text-[10px] text-ink-3">{fmtDate(d, "weekday")}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function OverviewTab({ summary, period }: { summary: HealthSummary; period: Period }) {
  const vs = vsLabel(period);
  const tile = (id: string, how: "avg" | "latest" = "avg") => {
    const pts = metricPoints(summary, id);
    return { pts, ...withDelta(pts, period, how), spark: sparkValues(pts, period) };
  };
  const steps = tile(ID.steps);
  const energy = tile(ID.activeEnergy);
  const exercise = tile(ID.exercise);
  const rhr = tile(ID.restingHr);
  const hrv = tile(ID.hrv);
  const sleepPts = summary.sleep.map((n) => ({ d: n.d, v: n.asleep }));
  const sleep = { ...withDelta(sleepPts, period), spark: sparkValues(sleepPts, period) };

  const stageRows = chartRows(summary.sleep, period, (n) => ({
    deep: n.deep / 60, core: n.core / 60, rem: n.rem / 60, awake: n.awake / 60, unspecified: n.unspecified / 60,
  }));
  const recent = within(summary.workouts, period.start, period.end).slice(-5).reverse();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <RingsCard summary={summary} period={period} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:col-span-2">
          <StatTile label="Steps" icon={<Footprints />} color="var(--c-activity)" value={fmtNum(steps.value)} unit="/ day" delta={steps.delta} better="up" deltaLabel={vs} spark={steps.spark} />
          <StatTile label="Active energy" icon={<Flame />} color="var(--c-move)" value={fmtNum(energy.value)} unit="kcal" delta={energy.delta} better="up" deltaLabel={vs} spark={energy.spark} />
          <StatTile label="Exercise" icon={<Timer />} color="var(--c-exercise)" value={fmtNum(exercise.value)} unit="min" delta={exercise.delta} better="up" deltaLabel={vs} spark={exercise.spark} />
          <StatTile label="Resting heart rate" icon={<HeartPulse />} color="var(--c-heart)" value={fmtNum(rhr.value)} unit="bpm" delta={rhr.delta} better="down" deltaLabel={vs} spark={rhr.spark} />
          <StatTile label="Heart rate variability" icon={<Waves />} color="var(--c-heart)" value={fmtNum(hrv.value)} unit="ms" delta={hrv.delta} better="up" deltaLabel={vs} spark={hrv.spark} />
          <StatTile label="Time asleep" icon={<Moon />} color="var(--c-core)" value={fmtDuration(sleep.value)} delta={sleep.delta} better="up" deltaLabel={vs} spark={sleep.spark} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricChart summary={summary} period={period} id={ID.steps} chart="bar" icon={<Footprints />} color="var(--c-activity)" />
        <MetricChart summary={summary} period={period} id={ID.restingHr} icon={<HeartPulse />} color="var(--c-heart)" />
        <ChartCard
          title="Sleep stages"
          icon={<Moon />}
          color="var(--c-core)"
          value={fmtDuration(sleep.value)}
          caption="Average time asleep"
          delta={sleep.delta}
          better="up"
          deltaLabel={vs}
          empty={sleep.value === null}
          legend={[...STAGES].reverse().filter((s) => s.key !== "unspecified" || stageRows.some((r) => (r.unspecified as number) > 0))}
        >
          <SleepStagesChart rows={stageRows} period={period} height={200} />
        </ChartCard>
        <MetricChart summary={summary} period={period} id={ID.hrv} icon={<Activity />} color="var(--c-heart)" />
      </div>

      <Card>
        <div className="mb-3 text-[13px] font-medium text-ink-2">Recent workouts</div>
        <WorkoutList workouts={recent} unit={summary.distanceUnit} compact />
      </Card>
    </div>
  );
}
