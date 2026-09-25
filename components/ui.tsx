"use client";

import { ArrowDownRight, ArrowUpRight, ChartColumn, Minus, Moon, Sun, Table2 } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { fmtNum } from "@/lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]", className)}>
      {children}
    </section>
  );
}

export function IconChip({ icon, color }: { icon: ReactNode; color: string }) {
  return (
    <span
      className="grid size-6 shrink-0 place-items-center rounded-md [&>svg]:size-3.5"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {icon}
    </span>
  );
}

export function Delta({ value, better, suffix }: { value: number | null; better?: "up" | "down"; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) return null;
  const flat = Math.abs(value) < 0.5;
  const good = better ? (better === "up") === value > 0 : null;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular",
        flat || good === null ? "text-ink-2" : good ? "text-good" : "text-bad",
      )}
      title={suffix ? `${value > 0 ? "+" : ""}${value.toFixed(1)}% ${suffix}` : undefined}
    >
      <Icon className="size-3.5" aria-hidden />
      {fmtNum(Math.abs(value), Math.abs(value) < 10 ? 1 : 0)}%
      {suffix && <span className="ml-1 font-normal text-ink-3">{suffix}</span>}
    </span>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`);
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function StatTile(props: {
  label: string;
  icon: ReactNode;
  color: string;
  value: string;
  unit?: string;
  delta?: number | null;
  better?: "up" | "down";
  deltaLabel?: string;
  spark?: number[];
  caption?: string;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-2 !p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
        <IconChip icon={props.icon} color={props.color} />
        <span className="truncate">{props.label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[26px] font-semibold leading-none tracking-tight">{props.value}</span>
        {props.unit && <span className="text-sm text-ink-2">{props.unit}</span>}
      </div>
      <div className="flex min-h-4 items-center justify-between gap-2">
        {props.delta !== undefined && props.delta !== null ? (
          <Delta value={props.delta} better={props.better} suffix={props.deltaLabel} />
        ) : (
          <span className="truncate text-xs text-ink-3">{props.caption ?? ""}</span>
        )}
      </div>
      {props.spark && props.spark.length > 1 && (
        <div className="-mb-1 opacity-80">
          <Sparkline values={props.spark} color={props.color} />
        </div>
      )}
    </Card>
  );
}

export interface TableSpec<R> {
  columns: { label: string; render: (row: R) => ReactNode; align?: "left" | "right" }[];
  rows: R[];
}

export function DataTable<R>({ columns, rows }: TableSpec<R>) {
  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-line">
      <table className="w-full text-left text-xs tabular">
        <thead className="sticky top-0 bg-surface-2 text-ink-2">
          <tr>
            {columns.map((c) => (
              <th key={c.label} className={cx("px-3 py-2 font-medium", c.align === "right" && "text-right")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {columns.map((c) => (
                <td key={c.label} className={cx("px-3 py-1.5", c.align === "right" && "text-right")}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  shape?: "square" | "line" | "dash";
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          {it.shape === "line" || it.shape === "dash" ? (
            <span
              className="h-0 w-3.5 border-t-2"
              style={{ borderColor: it.color, borderStyle: it.shape === "dash" ? "dashed" : "solid" }}
            />
          ) : (
            <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** A chart with its headline number, legend and a table-view twin. */
export function ChartCard<R>(props: {
  title: string;
  icon?: ReactNode;
  color: string;
  value?: string;
  unit?: string;
  caption?: string;
  delta?: number | null;
  better?: "up" | "down";
  deltaLabel?: string;
  legend?: LegendItem[];
  table?: TableSpec<R>;
  empty?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className={cx("min-w-0", props.className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
            {props.icon && <IconChip icon={props.icon} color={props.color} />}
            <h3 className="truncate">{props.title}</h3>
          </div>
          {props.value !== undefined && !props.empty && (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-2xl font-semibold tracking-tight">{props.value}</span>
              {props.unit && <span className="text-sm text-ink-2">{props.unit}</span>}
              {props.delta !== undefined && (
                <span className="ml-1">
                  <Delta value={props.delta} better={props.better} suffix={props.deltaLabel} />
                </span>
              )}
            </div>
          )}
          {props.caption && !props.empty && <p className="mt-0.5 text-xs text-ink-3">{props.caption}</p>}
        </div>
        {props.table && !props.empty && (
          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            aria-pressed={showTable}
            aria-label={showTable ? "Show chart" : "Show data table"}
            title={showTable ? "Show chart" : "Show data table"}
            className="rounded-lg p-1.5 text-ink-3 transition hover:bg-hover hover:text-ink"
          >
            {showTable ? <ChartColumn className="size-4" /> : <Table2 className="size-4" />}
          </button>
        )}
      </div>
      {props.legend && !props.empty && !showTable && (
        <div className="mt-3">
          <Legend items={props.legend} />
        </div>
      )}
      <div className="mt-4">
        {props.empty ? (
          <div className="grid h-40 place-items-center rounded-xl bg-surface-2 text-sm text-ink-3">
            No data in this period
          </div>
        ) : showTable && props.table ? (
          <DataTable {...props.table} />
        ) : (
          props.children
        )}
      </div>
    </Card>
  );
}

export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={props.label} className="inline-flex rounded-xl bg-surface-2 p-1">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          onClick={() => props.onChange(o.value)}
          className={cx(
            "rounded-lg px-3 py-1 text-[13px] font-medium transition",
            props.value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- theme -------------------------------------------------------------------

type Theme = "light" | "dark";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
function subscribeTheme(cb: () => void) {
  const mq = darkQuery();
  mq.addEventListener("change", cb);
  window.addEventListener("themechange", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("themechange", cb);
  };
}
function themeSnapshot(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "dark" || t === "light" ? t : darkQuery().matches ? "dark" : "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, themeSnapshot, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("theme", next);
        } catch {
          // Storage unavailable: the choice lasts for this page view.
        }
        window.dispatchEvent(new Event("themechange"));
      }}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid size-9 place-items-center rounded-xl text-ink-2 transition hover:bg-hover hover:text-ink"
    >
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="13" fill="none" stroke="var(--c-move)" strokeWidth="4" strokeDasharray="62 100" strokeLinecap="round" transform="rotate(-90 16 16)" />
      <circle cx="16" cy="16" r="8" fill="none" stroke="var(--c-exercise)" strokeWidth="4" strokeDasharray="38 100" strokeLinecap="round" transform="rotate(-90 16 16)" />
      <circle cx="16" cy="16" r="3" fill="none" stroke="var(--c-stand)" strokeWidth="3.4" strokeDasharray="15 100" strokeLinecap="round" transform="rotate(-90 16 16)" />
    </svg>
  );
}
