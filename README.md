# Pulse: Apple Watch Health Dashboard

A clean, private dashboard for everything your Apple Watch records: Activity rings, steps, heart rate, HRV, VO₂ max, blood oxygen, sleep stages, workouts, and every other data type in the Apple Health app.

Drop in the file the Health app exports and get interactive charts in seconds. **Your data never leaves your computer.** The file is processed inside your browser and nothing is uploaded anywhere.

Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4 and Recharts.

---

## Features

- **Overview:** today's Activity rings, the last 7 days of rings, key stats with trend lines, and recent workouts
- **Activity:** Move, Exercise and Stand against your goals, ring-closure rates and streaks, steps, distance, flights climbed, time in daylight
- **Heart:** daily heart-rate range, resting and walking heart rate, heart rate variability (HRV), cardio fitness (VO₂ max), cardio recovery, blood oxygen, respiratory rate, heart notifications
- **Sleep:** sleep stages per night (Awake, REM, Core, Deep), bedtime and wake-up schedule, stage breakdown, wrist temperature, breathing disturbances
- **Workouts:** totals, time per week, breakdown by activity type, and a full workout log
- **All data:** every data type found in your export (60+ are recognised), each with a chart, a table, sample counts and date ranges, plus your data sources

Across the app:

- Time ranges from 7 days to all time, with comparisons against the previous period
- A table view for every chart
- Light and dark mode
- Layouts that work on phone and desktop

## Getting started

**Requirements:** [Node.js](https://nodejs.org) 20.9 or newer.

```bash
git clone https://github.com/ayushpandeyy007/apple-health-dashboard.git
cd apple-health-dashboard
npm install
npm run dev
```

Open **http://localhost:3000**, then either:

- drop in your Health export (see below), or
- click **Try with demo data**, or open **http://localhost:3000/?demo**, to explore with realistic sample data.

## Exporting your data from the iPhone

Your Apple Watch syncs everything to the Health app on your iPhone, so the export comes from there:

1. Open the **Health** app on your iPhone.
2. Tap your **profile picture** in the top-right corner.
3. Tap **Export All Health Data**, then **Export**. Preparing the file can take a few minutes.
4. Send the resulting **export.zip** to your computer: AirDrop, Files / iCloud Drive, etc.
5. Drop it into the dashboard.

`export.zip`, the unzipped `apple_health_export` folder, and `export.xml` are all accepted. To refresh the dashboard later, export again and use **New export**.

## Privacy

- The export is read with a Web Worker **inside your browser**. There is no backend, no database and no analytics.
- The processed summary (a few MB at most) is saved in your browser's IndexedDB, so the dashboard is still there after a reload.
- The 🗑 button in the header removes it.
- `.gitignore` excludes `*.zip`, `export.xml` and `apple_health_export/`, so a Health export can't be committed by accident.

## How the numbers are calculated

- **No double counting.** Steps, distance and active energy are recorded by both your iPhone and your Watch. For every hour the dashboard keeps the larger of the two devices, so hours when the watch was off still count. It only falls back to third-party apps for hours neither device covered.
- **Activity rings** use the Watch's own daily Activity summaries, including your goals for each day.
- **Sleep.** A night runs 6 PM → 6 PM and is labelled with the morning you woke up. When several apps logged the same night, the source with sleep stages (normally the Apple Watch) is used.
- **Workouts** logged twice by different apps (for example the Watch and Strava) are merged.
- **Units** follow your Health app settings (km or mi, °C or °F, and so on). Energy is shown in kcal. Blood oxygen and other percentages are converted from HealthKit's fractions.
- **Trend comparisons** compare the selected range with the range of the same length just before it. Ranges end on the last day in your export.

## Performance

The parser scans the XML in a single streaming pass without building a DOM, so memory stays flat regardless of file size.

- A 250 MB export (≈590k records) imports in about **1 second**.
- Multi-gigabyte exports take seconds.
- ZIP64 archives (over 4 GB) are supported.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project structure

```
app/                         Next.js App Router entry (layout, page, global styles)
components/
  HealthApp.tsx              loads saved data, switches between import screen and dashboard
  ImportScreen.tsx           drag & drop, export instructions, progress
  Dashboard.tsx              header, tabs, time-range filter
  tabs/                      Overview, Activity, Heart, Sleep, Workouts, All data
  charts.tsx                 Recharts wrappers (trend bars/lines, ranges, sleep charts)
  ui.tsx                     cards, stat tiles, legends, tables, theme toggle
lib/health/
  parser.ts                  streaming export.xml parser and daily aggregation
  zip.ts                     reads export.zip in place and inflates with DecompressionStream
  parse.worker.ts            Web Worker: file → XML stream → parser → summary
  catalog.ts                 friendly names, units and categories for HealthKit types
  series.ts                  date ranges, bucketing and period comparisons
  demo.ts                    deterministic sample data
  storage.ts                 IndexedDB persistence
```

## Troubleshooting

- **"This doesn't look like an Apple Health export"**: make sure you picked `export.zip` (or `export.xml`), not `export_cda.xml` or a workout route file.
- **The zip won't open in an older browser**: unzip it and drop `export.xml` instead. Reading zips directly needs a current Chrome, Edge, Firefox or Safari (16.4+).
- **Numbers differ slightly from the Health app**: Apple de-duplicates sources with its own internal priority list. This dashboard approximates it per hour, which is usually within a few percent.
- **No sleep stages**: stages need an Apple Watch with watchOS 9 or later and Sleep tracking turned on. Older nights show as "Asleep (no stages)".

---

Not affiliated with Apple. Apple Watch and Apple Health are trademarks of Apple Inc.
