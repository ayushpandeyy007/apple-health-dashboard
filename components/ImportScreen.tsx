"use client";

import { ArrowLeft, CircleAlert, FileArchive, Lock, Sparkles, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { fmtNum } from "@/lib/format";
import { fileFromDrop, importHealthFile, type ImportProgress } from "@/lib/health/import";
import type { HealthSummary } from "@/lib/health/types";
import { cx, Logo, ThemeToggle } from "./ui";

const STEPS = [
  { title: "Open the Health app on your iPhone", body: "Your Apple Watch syncs everything to it automatically." },
  { title: "Tap your profile picture", body: "Top-right corner of the Summary screen." },
  { title: "Tap “Export All Health Data”", body: "Then confirm with Export. Preparing can take a few minutes." },
  { title: "Send export.zip to this computer", body: "AirDrop it, or save it to Files / iCloud Drive." },
  { title: "Drop it here", body: "The zip, the unzipped folder or export.xml all work." },
];

export function ImportScreen(props: { onLoaded: (s: HealthSummary) => void; onDemo: () => void; onCancel?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const [dragging, setDragging] = useState(false);
  const [job, setJob] = useState<{ name: string; progress: ImportProgress } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setJob({ name: file.name, progress: { loaded: 0, total: file.size, records: 0 } });
    const { promise, cancel } = importHealthFile(file, (progress) => setJob({ name: file.name, progress }));
    cancelRef.current = cancel;
    try {
      props.onLoaded(await promise);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setJob(null);
    }
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    try {
      await start(await fileFromDrop(e.dataTransfer.items));
    } catch {
      await start(e.dataTransfer.files[0]);
    }
  };

  const pct = job ? Math.min(100, (job.progress.loaded / Math.max(job.progress.total, 1)) * 100) : 0;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo className="size-7" />
          <span className="text-[17px] font-semibold tracking-tight">Pulse</span>
        </div>
        <div className="flex items-center gap-1">
          {props.onCancel && (
            <button type="button" onClick={props.onCancel} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-2 hover:bg-hover hover:text-ink">
              <ArrowLeft className="size-4" /> Back to dashboard
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:pt-14">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Your Apple Watch data, beautifully clear.</h1>
          <p className="mt-4 text-lg text-ink-2">
            Activity rings, heart rate, HRV, sleep stages, workouts and every other metric from your Health app, in one dashboard.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {job ? (
              <div className="rounded-3xl border border-line bg-surface p-8 shadow-[var(--shadow)]">
                <div className="flex items-center gap-3">
                  <FileArchive className="size-6 text-ink-2" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{job.name}</div>
                    <div className="text-sm text-ink-2 tabular">
                      Reading your data… {fmtNum(pct)}% · {fmtNum(job.progress.records)} records
                    </div>
                  </div>
                </div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-[var(--c-core)] transition-[width] duration-150" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-6 flex items-center justify-between text-sm text-ink-3">
                  <span>Large exports can take a minute. Everything stays on this device.</span>
                  <button
                    type="button"
                    onClick={() => {
                      cancelRef.current?.();
                      setJob(null);
                    }}
                    className="rounded-lg px-3 py-1.5 font-medium text-ink-2 hover:bg-hover hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cx(
                  "flex flex-col items-center rounded-3xl border-2 border-dashed bg-surface px-6 py-14 text-center transition",
                  dragging ? "border-[var(--c-core)] bg-[color-mix(in_srgb,var(--c-core)_6%,var(--surface))]" : "border-line",
                )}
              >
                <div className="grid size-14 place-items-center rounded-2xl bg-surface-2">
                  <Upload className="size-6 text-ink-2" />
                </div>
                <h2 className="mt-5 text-xl font-semibold">Drop your export.zip here</h2>
                <p className="mt-1.5 text-sm text-ink-2">export.zip, the apple_health_export folder, or export.xml</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => input.current?.click()}
                    className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-surface transition hover:opacity-90"
                  >
                    Choose file
                  </button>
                  <button
                    type="button"
                    onClick={props.onDemo}
                    className="flex items-center gap-2 rounded-xl border border-line px-5 py-2.5 text-sm font-semibold transition hover:bg-hover"
                  >
                    <Sparkles className="size-4" /> Try with demo data
                  </button>
                </div>
                <input
                  ref={input}
                  type="file"
                  accept=".zip,.xml,application/zip,text/xml"
                  className="hidden"
                  onChange={(e) => {
                    void start(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
            {error && (
              <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" />
                <div>
                  <div className="font-medium">We couldn’t read that file</div>
                  <div className="text-ink-2">{error}</div>
                </div>
              </div>
            )}
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-2">
              <Lock className="size-4" /> Private by design. Your file is read in this browser and never uploaded.
            </p>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-6 shadow-[var(--shadow)] lg:col-span-2">
            <h2 className="font-semibold">How to export from your iPhone</h2>
            <ol className="mt-5 space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold tabular">{i + 1}</span>
                  <div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-sm text-ink-2">{s.body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
