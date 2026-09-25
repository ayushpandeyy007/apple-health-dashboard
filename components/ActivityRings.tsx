import type { ActivityDay } from "@/lib/health/types";

const RINGS = [
  { key: "move", goal: "moveGoal", color: "var(--c-move)" },
  { key: "exercise", goal: "exerciseGoal", color: "var(--c-exercise)" },
  { key: "stand", goal: "standGoal", color: "var(--c-stand)" },
] as const;

export function ringProgress(day: ActivityDay) {
  return RINGS.map((r) => (day[r.goal] > 0 ? day[r.key] / day[r.goal] : 0));
}

/** Apple-style concentric Move / Exercise / Stand rings. */
export function ActivityRings({ day, size = 160, label }: { day?: ActivityDay; size?: number; label?: string }) {
  const sw = size * 0.105;
  const gap = Math.max(1.5, sw * 0.16);
  const progress = day ? ringProgress(day) : [0, 0, 0];
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={
        label ??
        (day
          ? `Move ${Math.round(progress[0] * 100)}%, Exercise ${Math.round(progress[1] * 100)}%, Stand ${Math.round(progress[2] * 100)}%`
          : "No activity data")
      }
    >
      {RINGS.map((ring, i) => {
        const r = size / 2 - sw / 2 - i * (sw + gap);
        const c = 2 * Math.PI * r;
        const p = Math.min(progress[i], 1);
        return (
          <g key={ring.key} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring.color} strokeOpacity={0.2} strokeWidth={sw} />
            {p > 0.005 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeDasharray={`${c * p} ${c}`}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
