"use client";

import { Database, Smartphone, Watch, AppWindow } from "lucide-react";
import { useState } from "react";
import { MetricChart } from "@/components/MetricChart";
import { Card } from "@/components/ui";
import { fmtDate, fmtNum } from "@/lib/format";
import { CATEGORIES, categoryColor, metricInfo } from "@/lib/health/catalog";
import type { Period } from "@/lib/health/series";
import type { HealthSummary } from "@/lib/health/types";

/** Every metric in the export, browsable one at a time. */
export function ExplorerTab({ summary, period }: { summary: HealthSummary; period: Period }) {
  const all = Object.values(summary.metrics)
    .map((s) => ({ s, info: metricInfo(s.id, s) }))
    .sort((a, b) => a.info.label.localeCompare(b.info.label));
  const [selected, setSelected] = useState(all.find((m) => m.s.id.endsWith("StepCount"))?.s.id ?? all[0]?.s.id);
  const current = all.find((m) => m.s.id === selected);

  return (
    <div className="space-y-4">
      <Card>
        <label htmlFor="metric" className="block text-[13px] font-medium text-ink-2">
          Choose any of the {all.length} data types in your export
        </label>
        <select
          id="metric"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-link sm:max-w-md"
        >
          {CATEGORIES.map((c) => {
            const items = all.filter((m) => m.info.category === c.key);
            return items.length ? (
              <optgroup key={c.key} label={c.label}>
                {items.map((m) => (
                  <option key={m.s.id} value={m.s.id}>
                    {m.info.label}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </Card>

      {current && (
        <MetricChart
          key={current.s.id}
          summary={summary}
          period={period}
          id={current.s.id}
          icon={<Database />}
          color={categoryColor(current.info.category)}
          chart={current.s.kind === "avg" ? "line" : "bar"}
          how={current.s.kind === "avg" ? "avg" : "avg"}
          dots={current.s.points.length < 60}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 text-[13px] font-medium text-ink-2">All data types</div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-sm tabular">
              <thead className="sticky top-0 bg-surface text-xs text-ink-2">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Metric</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 text-right font-medium">Samples</th>
                  <th className="py-2 text-right font-medium">Date range</th>
                </tr>
              </thead>
              <tbody>
                {all.map(({ s, info }) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-hover"
                  >
                    <td className="py-2 pr-3 font-medium">
                      <span className="mr-2 inline-block size-2 rounded-full" style={{ background: categoryColor(info.category) }} />
                      {info.label}
                    </td>
                    <td className="py-2 pr-3 text-ink-2">{CATEGORIES.find((c) => c.key === info.category)?.label}</td>
                    <td className="py-2 pr-3 text-right">{fmtNum(s.samples)}</td>
                    <td className="whitespace-nowrap py-2 text-right text-ink-2">
                      {fmtDate(s.points[0]?.d)} – {fmtDate(s.points[s.points.length - 1]?.d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <div className="mb-3 text-[13px] font-medium text-ink-2">Data sources</div>
          <ul className="space-y-3">
            {summary.sources.slice(0, 12).map((src) => (
              <li key={src.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {src.kind === "watch" ? (
                    <Watch className="size-4 shrink-0 text-ink-2" />
                  ) : src.kind === "phone" ? (
                    <Smartphone className="size-4 shrink-0 text-ink-2" />
                  ) : (
                    <AppWindow className="size-4 shrink-0 text-ink-2" />
                  )}
                  <span className="truncate">{src.name}</span>
                </span>
                <span className="shrink-0 tabular text-ink-2">{fmtNum(src.records)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
            {fmtNum(summary.totalRecords)} records · steps, distance and energy recorded by both iPhone and Apple Watch are
            de-duplicated per hour.
          </p>
        </Card>
      </div>
    </div>
  );
}
