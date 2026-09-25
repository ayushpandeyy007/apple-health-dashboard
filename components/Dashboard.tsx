"use client";

import { Lock, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { fmtDate, fmtNum } from "@/lib/format";
import { periodFor, RANGES, type RangeKey } from "@/lib/health/series";
import type { HealthSummary } from "@/lib/health/types";
import { ActivityTab } from "./tabs/ActivityTab";
import { ExplorerTab } from "./tabs/ExplorerTab";
import { HeartTab } from "./tabs/HeartTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { SleepTab } from "./tabs/SleepTab";
import { WorkoutsTab } from "./tabs/WorkoutsTab";
import { cx, Logo, Segmented, ThemeToggle } from "./ui";

const TABS = [
  { key: "overview", label: "Overview", Component: OverviewTab },
  { key: "activity", label: "Activity", Component: ActivityTab },
  { key: "heart", label: "Heart", Component: HeartTab },
  { key: "sleep", label: "Sleep", Component: SleepTab },
  { key: "workouts", label: "Workouts", Component: WorkoutsTab },
  { key: "all", label: "All data", Component: ExplorerTab },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = (key === "tab" ? window.location.hash.slice(1) : localStorage.getItem(key)) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function Dashboard(props: { summary: HealthSummary; onReplace: () => void; onClear: () => void }) {
  const { summary } = props;
  const [tab, setTab] = useState<TabKey>(() => readPref("tab", TABS.map((t) => t.key), "overview"));
  const [range, setRange] = useState<RangeKey>(() => readPref("range", RANGES.map((r) => r.key), "30d"));
  const period = periodFor(summary, range);
  const Active = TABS.find((t) => t.key === tab)!.Component;

  const selectTab = (key: TabKey) => {
    setTab(key);
    history.replaceState(null, "", `#${key}`);
    window.scrollTo({ top: 0 });
  };
  const selectRange = (key: RangeKey) => {
    setRange(key);
    try {
      localStorage.setItem("range", key);
    } catch {
      // Not persisted; fine.
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-[color-mix(in_srgb,var(--page)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6">
          <div className="flex h-14 shrink-0 items-center gap-2.5">
            <Logo className="size-7" />
            <span className="text-[17px] font-semibold tracking-tight">Pulse</span>
            {summary.demo && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">Demo data</span>
            )}
          </div>
          <nav className="no-scrollbar -mb-px flex flex-1 gap-1 overflow-x-auto" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={cx(
                  "h-14 shrink-0 border-b-2 px-3 text-sm font-medium transition",
                  tab === t.key ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={props.onReplace}
              className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-2 transition hover:bg-hover hover:text-ink sm:flex"
            >
              <RefreshCw className="size-4" />
              {summary.demo ? "Import my data" : "New export"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Remove the imported data from this browser?")) props.onClear();
              }}
              aria-label="Remove data from this browser"
              title="Remove data from this browser"
              className="grid size-9 place-items-center rounded-xl text-ink-2 transition hover:bg-hover hover:text-ink"
            >
              <Trash2 className="size-[18px]" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Segmented label="Time range" value={range} onChange={selectRange} options={RANGES.map((r) => ({ value: r.key, label: r.label }))} />
          <span className="text-sm text-ink-2">
            {fmtDate(period.start)} – {fmtDate(period.end)}
          </span>
        </div>
        <Active summary={summary} period={period} />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-ink-3 sm:px-6">
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" /> Processed on this device. Nothing is uploaded.
          </span>
          <span>
            {summary.demo ? "Sample data" : summary.fileName} · {fmtNum(summary.totalRecords)} records · data from{" "}
            {fmtDate(summary.range.start)} to {fmtDate(summary.range.end)}
            {summary.exportDate && !summary.demo ? ` · exported ${fmtDate(summary.exportDate)}` : ""}
          </span>
        </div>
      </footer>
    </div>
  );
}
