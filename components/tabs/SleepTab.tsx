"use client";

import { AlarmClock, BedDouble, Moon, MoonStar, Thermometer, Wind } from "lucide-react";
import { SleepScheduleChart, SleepStagesChart, STAGES, TrendLine } from "@/components/charts";
import { MetricChart, valueTable, vsLabel } from "@/components/MetricChart";
import { Card, ChartCard, Legend, StatTile } from "@/components/ui";
import { fmtBucket, fmtClock, fmtDuration, fmtNum } from "@/lib/format";
import { ID, metricInfo } from "@/lib/health/catalog";
import { chartRows, mean, sparkValues, within, withDelta, type Period } from "@/lib/health/series";
import type { HealthSummary } from "@/lib/health/types";

export function SleepTab({ summary, period }: { summary: HealthSummary; period: Period }) {
  if (!summary.sleep.length) {
    return (
      <Card className="py-16 text-center">
        <MoonStar className="mx-auto size-8 text-ink-3" />
        <h3 className="mt-3 font-semibold">No sleep data in this export</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
          Turn on Sleep Focus in the Health app and wear your Apple Watch to bed to track sleep stages, then export again.
        </p>
      </Card>
    );
  }
  const vs = vsLabel(period);
  const nights = within(summary.sleep, period.start, period.end);
  const tile = (pick: (n: HealthSummary["sleep"][number]) => number | undefined) => {
    const pts = summary.sleep.flatMap((n) => (pick(n) === undefined ? [] : [{ d: n.d, v: pick(n)! }]));
    return { ...withDelta(pts, period), spark: sparkValues(pts, period) };
  };
  const asleep = tile((n) => n.asleep);
  const deep = tile((n) => (n.deep ? n.deep : undefined));
  const rem = tile((n) => (n.rem ? n.rem : undefined));
  const starts = nights.flatMap((n) => (n.start === undefined ? [] : [n.start]));
  const ends = nights.flatMap((n) => (n.end === undefined ? [] : [n.end]));
  const bedtime = mean(starts);
  const wake = mean(ends);
  const consistency = bedtime === null ? null : Math.sqrt(mean(starts.map((s) => (s - bedtime) ** 2)) ?? 0);

  const stageRows = chartRows(summary.sleep, period, (n) => ({
    deep: n.deep / 60, core: n.core / 60, rem: n.rem / 60, awake: n.awake / 60, unspecified: n.unspecified / 60,
  }));
  const scheduleRows = chartRows(summary.sleep, period, (n) => ({ start: n.start, end: n.end }));
  const hasUnspecified = nights.some((n) => n.unspecified > 0);
  const legend = [...STAGES].reverse().filter((s) => s.key !== "unspecified" || hasUnspecified);

  const totals = STAGES.map((s) => ({ ...s, min: nights.reduce((a, n) => a + n[s.key], 0) }));
  const all = totals.reduce((a, s) => a + s.min, 0) || 1;

  // Wrist temperature as deviation from your own baseline, like the Health app.
  const temp = summary.metrics[ID.wristTemp];
  const tempUnit = temp ? metricInfo(ID.wristTemp, temp).unit : "";
  const baseline = temp ? [...temp.points].map((p) => p.v).sort((a, b) => a - b)[Math.floor(temp.points.length / 2)] : 0;
  const tempRows = temp ? chartRows(temp.points, period, (p) => ({ v: p.v - baseline })) : [];
  const fmtTemp = (v: number) => `${v > 0 ? "+" : ""}${fmtNum(v, 2)} ${tempUnit}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Time asleep" icon={<Moon />} color="var(--c-core)" value={fmtDuration(asleep.value)} delta={asleep.delta} better="up" deltaLabel={vs} spark={asleep.spark} />
        <StatTile label="Deep sleep" icon={<Moon />} color="var(--c-deep)" value={fmtDuration(deep.value)} delta={deep.delta} better="up" deltaLabel={vs} spark={deep.spark} />
        <StatTile label="REM sleep" icon={<Moon />} color="var(--c-rem)" value={fmtDuration(rem.value)} delta={rem.delta} better="up" deltaLabel={vs} spark={rem.spark} />
        <StatTile label="Avg. bedtime" icon={<BedDouble />} color="var(--c-core)" value={fmtClock(bedtime)} caption={`${nights.length} nights tracked`} />
        <StatTile label="Avg. wake-up" icon={<AlarmClock />} color="var(--c-core)" value={fmtClock(wake)} caption="End of last sleep stage" />
        <StatTile label="Bedtime consistency" icon={<BedDouble />} color="var(--c-core)" value={consistency === null ? "—" : `±${fmtNum(consistency)}`} unit="min" caption="Typical variation" />
      </div>

      <ChartCard
        title="Sleep stages"
        icon={<Moon />}
        color="var(--c-core)"
        value={fmtDuration(asleep.value)}
        caption={period.gran === "day" ? "Hours per night" : `Average hours per night, grouped by ${period.gran}`}
        delta={asleep.delta}
        better="up"
        deltaLabel={vs}
        empty={!nights.length}
        legend={legend}
        table={{
          columns: [
            { label: "Night", render: (r) => fmtBucket(r.key, period.gran) },
            ...legend.map((s) => ({ label: s.label, align: "right" as const, render: (r: (typeof stageRows)[number]) => fmtDuration((r[s.key] as number) * 60) })),
          ],
          rows: stageRows.filter((r) => typeof r.core === "number" || typeof r.unspecified === "number").reverse(),
        }}
      >
        <SleepStagesChart rows={stageRows} period={period} height={260} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Sleep schedule"
          icon={<BedDouble />}
          color="var(--c-core)"
          value={`${fmtClock(bedtime)} – ${fmtClock(wake)}`}
          caption="Average time asleep window"
          empty={!starts.length}
          table={{
            columns: [
              { label: "Night", render: (r) => fmtBucket(r.key, period.gran) },
              { label: "Fell asleep", align: "right", render: (r) => fmtClock(r.start as number) },
              { label: "Woke up", align: "right", render: (r) => fmtClock(r.end as number) },
            ],
            rows: scheduleRows.filter((r) => typeof r.start === "number").reverse(),
          }}
        >
          <SleepScheduleChart rows={scheduleRows} period={period} />
        </ChartCard>

        <Card>
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
            <Moon className="size-4" /> Where your night goes
          </div>
          <p className="mt-0.5 text-xs text-ink-3">Share of tracked time, {nights.length} nights</p>
          <div className="mt-5 flex h-4 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Sleep stage share">
            {[...totals].reverse().filter((s) => s.min > 0).map((s) => (
              <div key={s.key} style={{ width: `${(s.min / all) * 100}%`, background: s.color }} title={`${s.label}: ${fmtNum((s.min / all) * 100)}%`} />
            ))}
          </div>
          <ul className="mt-5 divide-y divide-line text-sm">
            {[...totals].reverse().filter((s) => s.min > 0).map((s) => (
              <li key={s.key} className="flex items-center justify-between py-2.5">
                <Legend items={[{ label: s.label, color: s.color }]} />
                <span className="tabular text-ink-2">
                  <span className="font-semibold text-ink">{fmtNum((s.min / all) * 100)}%</span> · {fmtDuration(s.min / Math.max(nights.length, 1))} / night
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {temp && (
          <ChartCard
            title="Wrist temperature"
            icon={<Thermometer />}
            color="var(--c-body)"
            value={fmtTemp(mean(within(temp.points, period.start, period.end).map((p) => p.v - baseline)) ?? 0)}
            caption={`Average deviation from your baseline (${fmtNum(baseline, 2)} ${tempUnit})`}
            empty={!within(temp.points, period.start, period.end).length}
            table={valueTable(tempRows, period, "Deviation", fmtTemp)}
          >
            <TrendLine rows={tempRows} period={period} color="var(--c-body)" label="vs baseline" format={fmtTemp} baseline={0} />
          </ChartCard>
        )}
        <MetricChart summary={summary} period={period} id={ID.breathing} icon={<Wind />} color="var(--c-resp)" />
        <MetricChart summary={summary} period={period} id={ID.respRate} icon={<Wind />} color="var(--c-resp)" />
      </div>
    </div>
  );
}
