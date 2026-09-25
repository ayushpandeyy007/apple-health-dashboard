"use client";

import { Activity, Droplet, Footprints, Gauge, HeartPulse, TrendingDown, Waves, Wind } from "lucide-react";
import { RangeChart } from "@/components/charts";
import { MetricChart, aggCaption, vsLabel } from "@/components/MetricChart";
import { Card, ChartCard, StatTile } from "@/components/ui";
import { fmtBucket, fmtNum } from "@/lib/format";
import { ID, metricInfo } from "@/lib/health/catalog";
import { chartRows, metricPoints, sparkValues, within, withDelta, type Period } from "@/lib/health/series";
import type { HealthSummary } from "@/lib/health/types";

export function HeartTab({ summary, period }: { summary: HealthSummary; period: Period }) {
  const vs = vsLabel(period);
  const tile = (id: string, how: "avg" | "latest" = "avg") => {
    const pts = metricPoints(summary, id);
    return { ...withDelta(pts, period, how), spark: sparkValues(pts, period) };
  };
  const rhr = tile(ID.restingHr);
  const hrv = tile(ID.hrv);
  const walk = tile(ID.walkingHr);
  const vo2 = tile(ID.vo2max, "latest");
  const spo2 = tile(ID.spo2);
  const resp = tile(ID.respRate);

  const hr = metricPoints(summary, ID.heartRate);
  const hrRows = chartRows(hr, period, (p) => ({ v: p.v, min: p.min ?? p.v, max: p.max ?? p.v }), { min: "min", max: "max" });
  const inRange = within(hr, period.start, period.end);
  const alerts = [
    { id: ID.highHr, label: "High heart rate" },
    { id: ID.lowHr, label: "Low heart rate" },
    { id: ID.irregular, label: "Irregular rhythm" },
  ].map((a) => ({ ...a, n: within(metricPoints(summary, a.id), period.start, period.end).reduce((s, p) => s + p.v, 0) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Resting heart rate" icon={<HeartPulse />} color="var(--c-heart)" value={fmtNum(rhr.value)} unit="bpm" delta={rhr.delta} better="down" deltaLabel={vs} spark={rhr.spark} />
        <StatTile label="HRV" icon={<Waves />} color="var(--c-heart)" value={fmtNum(hrv.value)} unit="ms" delta={hrv.delta} better="up" deltaLabel={vs} spark={hrv.spark} />
        <StatTile label="Walking heart rate" icon={<Footprints />} color="var(--c-heart)" value={fmtNum(walk.value)} unit="bpm" delta={walk.delta} better="down" deltaLabel={vs} spark={walk.spark} />
        <StatTile label="Cardio fitness" icon={<Gauge />} color="var(--c-heart)" value={fmtNum(vo2.value, 1)} unit="VO₂ max" delta={vo2.delta} better="up" deltaLabel={vs} spark={vo2.spark} />
        <StatTile label="Blood oxygen" icon={<Droplet />} color="var(--c-resp)" value={fmtNum(spo2.value, 1)} unit="%" delta={spo2.delta} deltaLabel={vs} spark={spo2.spark} />
        <StatTile label="Respiratory rate" icon={<Wind />} color="var(--c-resp)" value={fmtNum(resp.value, 1)} unit="br/min" delta={resp.delta} deltaLabel={vs} spark={resp.spark} />
      </div>

      {hr.length > 0 && (
        <ChartCard
          title="Heart rate"
          icon={<HeartPulse />}
          color="var(--c-heart)"
          value={inRange.length ? `${fmtNum(Math.min(...inRange.map((p) => p.min ?? p.v)))}–${fmtNum(Math.max(...inRange.map((p) => p.max ?? p.v)))}` : "—"}
          unit="bpm"
          caption={`Range for the period · ${aggCaption(period, "avg", "daily average line")}`}
          empty={!inRange.length}
          legend={[
            { label: "Daily low–high range", color: "color-mix(in srgb, var(--c-heart) 30%, transparent)" },
            { label: "Average", color: "var(--c-heart)", shape: "line" },
          ]}
          table={{
            columns: [
              { label: "Period", render: (r) => fmtBucket(r.key, period.gran) },
              { label: "Low", align: "right", render: (r) => fmtNum(r.min as number) },
              { label: "Average", align: "right", render: (r) => fmtNum(r.v as number) },
              { label: "High", align: "right", render: (r) => fmtNum(r.max as number) },
            ],
            rows: hrRows.filter((r) => typeof r.v === "number").reverse(),
          }}
        >
          <RangeChart rows={hrRows} period={period} color="var(--c-heart)" unit="bpm" />
        </ChartCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricChart summary={summary} period={period} id={ID.restingHr} icon={<HeartPulse />} color="var(--c-heart)" />
        <MetricChart summary={summary} period={period} id={ID.hrv} icon={<Waves />} color="var(--c-heart)" />
        <MetricChart summary={summary} period={period} id={ID.walkingHr} icon={<Footprints />} color="var(--c-heart)" />
        <MetricChart summary={summary} period={period} id={ID.vo2max} icon={<Gauge />} color="var(--c-heart)" how="latest" dots />
        <MetricChart summary={summary} period={period} id={ID.recovery} icon={<TrendingDown />} color="var(--c-heart)" dots />
        <MetricChart summary={summary} period={period} id={ID.spo2} icon={<Droplet />} color="var(--c-resp)" />
        <MetricChart summary={summary} period={period} id={ID.respRate} icon={<Wind />} color="var(--c-resp)" />
      </div>

      {alerts.some((a) => summary.metrics[a.id]) && (
        <Card>
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
            <Activity className="size-4" /> Heart notifications in this period
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {alerts.map((a) => (
              <div key={a.id} className="rounded-xl bg-surface-2 px-4 py-3">
                <div className="text-xs text-ink-2">{metricInfo(a.id).label}</div>
                <div className="text-xl font-semibold">{a.n}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
