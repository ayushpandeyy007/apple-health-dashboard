"use client";

import { useEffect, useState } from "react";
import { createDemoSummary } from "@/lib/health/demo";
import { clearSummary, loadSummary, saveSummary } from "@/lib/health/storage";
import type { HealthSummary } from "@/lib/health/types";
import { Dashboard } from "./Dashboard";
import { ImportScreen } from "./ImportScreen";
import { Logo } from "./ui";

type State =
  | { status: "loading" }
  | { status: "import"; previous?: HealthSummary }
  | { status: "ready"; summary: HealthSummary };

export default function HealthApp() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    // "/?demo" shows sample data without touching anything saved in this browser.
    const demo = new URLSearchParams(window.location.search).has("demo");
    (demo ? Promise.resolve(createDemoSummary()) : loadSummary()).then((summary) => {
      if (alive) setState(summary ? { status: "ready", summary } : { status: "import" });
    });
    return () => {
      alive = false;
    };
  }, []);

  const show = (summary: HealthSummary) => {
    setState({ status: "ready", summary });
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    window.scrollTo({ top: 0 });
    void saveSummary(summary);
  };

  if (state.status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <Logo className="size-10 animate-pulse" />
      </div>
    );
  }
  if (state.status === "import") {
    const previous = state.previous;
    return (
      <ImportScreen
        onLoaded={show}
        onDemo={() => show(createDemoSummary())}
        onCancel={previous ? () => setState({ status: "ready", summary: previous }) : undefined}
      />
    );
  }
  return (
    <Dashboard
      summary={state.summary}
      onReplace={() => setState({ status: "import", previous: state.summary })}
      onClear={() => {
        void clearSummary();
        setState({ status: "import" });
      }}
    />
  );
}
