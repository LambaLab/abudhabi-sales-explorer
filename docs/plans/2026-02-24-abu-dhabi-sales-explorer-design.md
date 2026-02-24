# Abu Dhabi Sales Explorer — Design Doc
**Date:** 2026-02-24
**Status:** Approved

---

## Overview

A public-facing web app for visualising Abu Dhabi real estate transaction data. Built for periodic CSV updates (no backend). Hosted on Vercel with a public URL.

---

## Data

- **Source:** `Abu Dhabi recent_sales.csv` (~104,848 rows, 2019–2026)
- **Key columns:**
  - `Sale Application Date` — transaction date
  - `Property Type` — apartment, villa, townhouse, duplex, plot, etc.
  - `Property Layout` — studio, 1 bed, 2 beds, … 6+ beds
  - `District` — Al Reem Island, Yas Island, Al Saadiyat Island, etc.
  - `Community` — sub-area within district
  - `Project Name` — specific development
  - `Property Sale Price (AED)` — transaction price
  - `Rate (AED per SQM)` — price per square metre
  - `Property Sold Area (SQM)` — unit size
  - `Sale Application Type` — off-plan / ready / court-mandated
  - `Sale Sequence` — primary / secondary market
- **Update mechanism:** Replace CSV file in repo → `git push` → Vercel auto-redeploys

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Vite + React | Fast, simple, no server needed |
| In-browser DB | DuckDB-WASM | SQL queries on 104K rows at native speed |
| Charts | Recharts | Clean, composable, React-native |
| Styling | Tailwind CSS | Minimal, utility-first |
| Hosting | Vercel | Free tier, auto-deploy from GitHub |

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  Abu Dhabi Sales Explorer          [Date Range Picker]  │
├──────────────┬──────────────────────────────────────────┤
│ FILTERS      │                                          │
│              │  ┌─────────────┐  ┌─────────────┐       │
│ District     │  │ Median Price│  │ Price/SQM   │       │
│ Property Type│  │ over Time   │  │ over Time   │       │
│ Layout       │  └─────────────┘  └─────────────┘       │
│ Sale Type    │                                          │
│ Price Range  │  ┌──────────────────────────────────┐   │
│              │  │ Project Comparison (multi-line)  │   │
│ Projects     │  └──────────────────────────────────┘   │
│ (multi-pick) │                                          │
│              │  ┌──────────────────────────────────┐   │
│              │  │ Transaction Volume over Time      │   │
│              │  └──────────────────────────────────┘   │
└──────────────┴──────────────────────────────────────────┘
```

---

## Charts

### 1. Median Price over Time
- Type: Line chart
- X: Month/Year, Y: Median sale price (AED)
- Respects all active filters
- Tooltip shows median + transaction count

### 2. Price per SQM over Time
- Type: Line chart
- X: Month/Year, Y: Median AED/sqm
- Only shows rows where `Rate (AED per SQM)` is non-null
- Useful for comparing unit types fairly

### 3. Project Comparison
- Type: Multi-line chart (one line per selected project)
- X: Month/Year, Y: Median price (or price/sqm toggle)
- Users search and select 2–5 projects from a searchable dropdown
- Each project gets a distinct colour
- Respects date range but ignores other filters (to allow cross-district comparison)

### 4. Transaction Volume over Time
- Type: Bar chart
- X: Month/Year, Y: Number of transactions
- Helps identify market activity peaks/troughs

---

## Filters (left sidebar)

| Filter | Type | Options |
|---|---|---|
| Date Range | Date range picker (top bar) | Min: 2019-01-01, Max: latest in data |
| District | Multi-select dropdown | All unique districts |
| Property Type | Multi-select checkbox | apartment, villa, townhouse, duplex, plot, etc. |
| Layout | Multi-select checkbox | studio, 1 bed, 2 beds, 3 beds, 4 beds, 5 beds, 6+ beds |
| Sale Type | Toggle pills | All / Off-plan / Ready |
| Market | Toggle pills | All / Primary / Secondary |
| Price Range | Dual-handle range slider | AED 0 – max in filtered data |

---

## UX Details

- **Loading state:** Full-screen spinner with "Loading 104,000+ records…" while DuckDB initialises (~3–5s first visit, then browser-cached)
- **Empty state:** "No results for these filters" message if query returns 0 rows
- **Responsive:** Sidebar collapses to top filter drawer on mobile
- **Project search:** Debounced text input filters project list in real time
- **Chart tooltips:** All charts show exact values + sample size on hover

---

## Deployment (non-developer steps)

1. Push code to GitHub (Claude will set this up)
2. Go to vercel.com → import GitHub repo → deploy (one-click)
3. Vercel gives a public URL (e.g. `abudhabi-sales.vercel.app`)
4. **To update data:** Replace CSV file → `git push` → auto-redeploys in ~1 min

---

## File Structure

```
abudhabi-sales-explorer/
├── public/
│   └── data/
│       └── abu_dhabi_sales.csv       ← the data file (replace to update)
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── Sidebar.jsx               ← all filters
│   │   ├── DateRangePicker.jsx       ← global date control
│   │   ├── charts/
│   │   │   ├── MedianPriceChart.jsx
│   │   │   ├── PricePerSqmChart.jsx
│   │   │   ├── ProjectComparison.jsx
│   │   │   └── VolumeChart.jsx
│   │   └── ProjectSearch.jsx         ← searchable multi-select
│   ├── hooks/
│   │   ├── useDuckDB.js              ← initialise DuckDB, load CSV
│   │   └── useChartData.js           ← run queries, return chart-ready data
│   └── utils/
│       └── queries.js                ← SQL query builders
├── docs/plans/
│   └── 2026-02-24-abu-dhabi-sales-explorer-design.md
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```
