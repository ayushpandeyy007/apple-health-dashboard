"use client";

import {
  Activity, Bike, Dumbbell, Flame, Flower2, Footprints, HeartPulse, Mountain, PersonStanding, Route, Timer, Trophy, Waves, Zap,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { TrendBar } from "@/components/charts";
import { valueTable, vsLabel } from "@/components/MetricChart";
import { Card, ChartCard, IconChip, StatTile } from "@/components/ui";
import { fmtDate, fmtDuration, fmtNum, kmTo } from "@/lib/format";
import { chartRows, mean, within, type Period } from "@/lib/health/series";
import type { HealthSummary, Workout } from "@/lib/health/types";

const ICONS: [RegExp, ReactNode][] = [
  [/run/i, <Footprints key="run" />],
  [/walk/i, <PersonStanding key="walk" />],
  [/cycl|bike/i, <Bike key="bike" />],
  [/swim|water|surf|padd|row/i, <Waves key="swim" />],
  [/strength|core|cross|functional/i, <Dumbbell key="lift" />],
  [/yoga|pilates|mind|flex|cooldown|recovery|tai/i, <Flower2 key="yoga" />],
  [/hik|climb|stair/i, <Mountain key="hike" />],
  [/hiit|interval|cardio|dance|kick|box/i, <Zap key="hiit" />],
  [/tennis|ball|soccer|cricket|golf|hockey|sport|badminton|volley/i, <Trophy key="sport" />],
];
export const workoutIcon = (type: string) => ICONS.find(([re]) => re.test(type))?.[1] ?? <Activity />;

export function WorkoutList({ workouts, unit, compact }: { workouts: Workout[]; unit: "km" | "mi"; compact?: boolean }) {
  const [limit, setLimit] = useState(25);
  if (!workouts.length) return <p className="py-6 text-center text-sm text-ink-3">No workouts in this period</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm tabular">
        {!compact && (
          <thead className="text-xs text-ink-2">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-medium">Workout</th>
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 text-right font-medium">Duration</th>
              <th className="py-2 pr-3 text-right font-medium">Distance</th>
              <th className="py-2 pr-3 text-right font-medium">Energy</th>
              <th className="py-2 text-right font-medium">Avg HR</th>
            </tr>
          </thead>
        )}
        <tbody>
          {workouts.slice(0, limit).map((w, i) => (
            <tr key={`${w.d}-${w.time}-${i}`} className="border-b border-line last:border-0">
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2.5">
                  <IconChip icon={workoutIcon(w.type)} color="var(--c-exercise)" />
                  <span className="font-medium">{w.type}</span>
                </div>
              </td>
              <td className="py-2.5 pr-3 text-ink-2">
                {fmtDate(w.d, "medium")} · {w.time}
              </td>
              <td className="py-2.5 pr-3 text-right">{fmtDuration(w.duration)}</td>
              <td className="py-2.5 pr-3 text-right">{w.distanceKm ? `${fmtNum(kmTo(w.distanceKm, unit), 2)} ${unit}` : "—"}</td>
              <td className="py-2.5 pr-3 text-right">{w.energy ? `${fmtNum(w.energy)} kcal` : "—"}</td>
              <td className="py-2.5 text-right">{w.avgHr ? `${w.avgHr} bpm` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {workouts.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + 50)} className="mt-3 w-full rounded-xl bg-surface-2 py-2 text-sm font-medium text-ink-2 hover:text-ink">
          Show more ({workouts.length - limit} remaining)
        </button>
      )}
    </div>
  );
}

export function WorkoutsTab({ summary, period }: { summary: HealthSummary; period: Period }) {
  const vs = vsLabel(period);
  const unit = summary.distanceUnit;
  const list = within(summary.workouts, period.start, period.end);
  const prev = period.prev ? within(summary.workouts, period.prev.start, period.prev.end) : null;
  const sum = (ws: Workout[], f: (w: Workout) => number | undefined) => ws.reduce((a, w) => a + (f(w) ?? 0), 0);
  const pct = (a: number, b: number | null) => (b ? ((a - b) / b) * 100 : null);
  const minutes = sum(list, (w) => w.duration);
  const energy = sum(list, (w) => w.energy);
  const distance = kmTo(sum(list, (w) => w.distanceKm), unit);
  const avgHr = mean(list.flatMap((w) => (w.avgHr ? [w.avgHr] : [])));

  const byType = new Map<string, { n: number; min: number }>();
  for (const w of list) {
    const t = byType.get(w.type) ?? { n: 0, min: 0 };
    t.n++;
    t.min += w.duration;
    byType.set(w.type, t);
  }
  const types = [...byType.entries()].sort((a, b) => b[1].min - a[1].min);
  const maxMin = types[0]?.[1].min ?? 1;

  const bucketPeriod: Period = { ...period, gran: period.days <= 31 ? "day" : period.days <= 400 ? "week" : "month" };
  const rows = chartRows(list, bucketPeriod, (w) => ({ v: w.duration }), { v: "sum" }).map((r) => ({ ...r, v: r.v ?? 0 }));
  const perLabel = bucketPeriod.gran === "day" ? "per day" : `per ${bucketPeriod.gran}`;
  const fmtMin = (v: number) => fmtDuration(v);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Workouts" icon={<Trophy />} color="var(--c-exercise)" value={fmtNum(list.length)} delta={prev && pct(list.length, prev.length)} better="up" deltaLabel={vs} />
        <StatTile label="Total time" icon={<Timer />} color="var(--c-exercise)" value={fmtDuration(minutes)} delta={prev && pct(minutes, sum(prev, (w) => w.duration))} better="up" deltaLabel={vs} />
        <StatTile label="Active energy" icon={<Flame />} color="var(--c-move)" value={fmtNum(energy)} unit="kcal" delta={prev && pct(energy, sum(prev, (w) => w.energy))} better="up" deltaLabel={vs} />
        <StatTile label="Distance" icon={<Route />} color="var(--c-activity)" value={fmtNum(distance, 1)} unit={unit} delta={prev && pct(distance, kmTo(sum(prev, (w) => w.distanceKm), unit))} better="up" deltaLabel={vs} />
        <StatTile label="Avg. heart rate" icon={<HeartPulse />} color="var(--c-heart)" value={fmtNum(avgHr)} unit="bpm" caption="Across workouts" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-3"
          title="Workout time"
          icon={<Timer />}
          color="var(--c-exercise)"
          value={fmtDuration(minutes)}
          caption={`Minutes ${perLabel}`}
          empty={!list.length}
          table={valueTable(rows, bucketPeriod, "Workout time", fmtMin)}
        >
          <TrendBar rows={rows} period={bucketPeriod} color="var(--c-exercise)" label="Workout time" format={fmtMin} />
        </ChartCard>
        <Card className="lg:col-span-2">
          <div className="text-[13px] font-medium text-ink-2">By type</div>
          <p className="mt-0.5 text-xs text-ink-3">Time spent, {types.length} activity types</p>
          <ul className="mt-4 space-y-3">
            {types.slice(0, 8).map(([type, t]) => (
              <li key={type}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <IconChip icon={workoutIcon(type)} color="var(--c-exercise)" />
                    <span className="truncate">{type}</span>
                  </span>
                  <span className="shrink-0 tabular text-ink-2">
                    <span className="font-semibold text-ink">{fmtDuration(t.min)}</span> · {t.n}×
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${(t.min / maxMin) * 100}%`, background: "var(--c-exercise)" }} />
                </div>
              </li>
            ))}
            {!types.length && <li className="py-6 text-center text-sm text-ink-3">No workouts in this period</li>}
          </ul>
        </Card>
      </div>

      <Card>
        <div className="mb-2 text-[13px] font-medium text-ink-2">All workouts ({list.length})</div>
        <WorkoutList workouts={[...list].reverse()} unit={unit} />
      </Card>
    </div>
  );
}
