# UI Redesign Design Doc — 2026-02-26

## Goal

Overhaul the Abu Dhabi Sales Explorer UI with light/dark theming, a ChatGPT-style input experience, a curated Chart dashboard tab, mobile responsiveness, and several UX polish items.

---

## 1. Layout & Navigation

### Header
- **Remove** the "Abu Dhabi Sales Explorer" text header.
- **Add** Octopus logo (PNG from `https://freepngimg.com/icon/1000507-octopus-emoji-free-icon-hq`, with `🐙` emoji fallback if fetch fails) — left-aligned, ~32px tall.
- **Center**: Feed / Chart tab switcher (two pill tabs).
- **Right**: Sun/Moon theme toggle button.
- Header is `shrink-0`, sticky at top, `z-10`.

### Main Layout
```
┌─────────────────────────────────────┐
│  🐙  [Feed] [Chart]        ☀️ / 🌙  │
├─────────────────────────────────────┤
│                                     │
│  [Feed content / Chart content]     │  flex-1 overflow-y-auto
│                                     │
├─────────────────────────────────────┤
│  [+] [ Ask anything...          ■ ] │  ← Feed tab only, shrink-0
└─────────────────────────────────────┘
```

- Bottom input bar only visible in **Feed** tab.
- Chart tab fills the scrollable area with its own filter bar + chart grid.

### Mobile
- Header: logo + theme toggle, tabs on second row (centered, full-width)
- OR: all three fit on one row at 375px (logo 32px, tabs grow, toggle 32px)
- Feed: full-width, `px-4`
- Chart grid: single column

---

## 2. Theme System

### Approach
Tailwind CSS `dark:` variant with a `dark` class on `<html>`. **Light mode is the default.**

### Implementation
- `useTheme` hook: reads `localStorage.getItem('theme')` on init (default `'light'`), exposes `theme` + `toggle()`.
- On `toggle()`: sets `document.documentElement.classList.toggle('dark')` and saves to localStorage.
- `tailwind.config.js` (or `@theme` in CSS): `darkMode: 'class'`.
- All components updated with `dark:` variants.

### Light palette
| Token | Light | Dark |
|---|---|---|
| bg-base | `white` / `slate-50` | `#0f172a` |
| bg-card | `white` | `slate-800/30` |
| bg-input | `white` | `slate-800/60` |
| border | `slate-200` | `slate-700` |
| text-primary | `slate-900` | `slate-100` |
| text-muted | `slate-500` | `slate-500` |
| accent | `#e94560` | `#e94560` (unchanged) |

---

## 3. Input & Interaction

### Input bar layout
```
┌──────────────────────────────────────────────────┐
│  [+]  │  Ask anything about Abu Dhabi…      [→/■] │
└──────────────────────────────────────────────────┘
```
- Pill shape: `rounded-2xl`, single line that grows to max 4 rows.
- Light: `bg-white border-slate-200 shadow-sm`, focus: `border-accent ring-1 ring-accent/30`.
- Dark: existing `bg-slate-800/60 border-slate-700`.

### `+` menu button
- Left of the input, opens a small popover/menu **above** the input (or as bottom sheet on mobile).
- Menu items:
  - `📅 Date Range` — opens the default date range setting
  - _(future: `📎 Upload screenshot`)_
- **Date Range sub-option**: radio group:
  - Last 12 months _(default)_
  - Last 24 months
  - All time
  - Custom range (date pickers)
- Setting saved to `localStorage` via `useSettings` hook.
- Injected as context into every `analyze()` call: appended to the prompt as `"(default date range: last 12 months — apply unless the question specifies otherwise)"`.

### Suggestions overlay
- On input **focus** (not click, so keyboard nav works too): a dropdown appears above the input showing the 8 suggested analyses.
- Clicking a suggestion: fills `value` in the textarea, closes the overlay, does **not** submit.
- Overlay closes on: suggestion click, Escape, click outside, or when input loses focus (with 150ms delay to allow click to register).

### Submit / Stop button
- **Default state**: arrow icon `→`, submits on click or Enter.
- **Loading state**: square Stop icon `■` (or `⏹`). Clicking calls `abortRef.current.abort()` — same abort path as the ✕ on the post card.
- Transition: icon swaps instantly on submit.

---

## 4. Post Card — Loading State

When a query is submitted, the new post card appears **immediately** with:

```
┌────────────────────────────────────────────────┐
│  "3BR prices in Noya vs Yas Island"        [✕] │  ← prompt text + cancel button
│                                                │
│  ⟳  Crunching numbers…                         │  ← rotating label (cycles every 1.5s)
└────────────────────────────────────────────────┘
```

### Rotating labels (cycle every 1.5s)
```
Analyzing…  →  Thinking…  →  Crunching numbers…  →
Building chart…  →  Querying data…  →  Almost there…
```
Implementation: `useState(labelIndex)` + `setInterval` inside `useEffect`, cleared when status changes from loading.

### Answer shown all at once
- `streamExplain` still streams from the API (no server change needed).
- **Change**: `onChunk` accumulates into a local `fullText` ref — **no `patchPost` call per chunk**.
- Single `patchPost` call with final `{ status: 'done', analysisText: fullText }` when stream ends.
- This eliminates the typing effect, showing the full response at once.

### ✕ cancel button
- Shown only when `status` is `'analyzing' | 'querying' | 'explaining'`.
- Calls `onCancel(post.id)` → App calls `abortRef.current?.abort()`.
- Also updates the post to `{ status: 'error', error: 'Cancelled' }` or removes the post (TBD — remove is cleaner for cancelled queries).

---

## 5. Chart Tab

### Overview
A curated dashboard of 12 pre-defined charts. All charts share a global filter state (re-queries DuckDB when filters change). Each chart also has an **inline date range override**.

### Global filters (collapsible bar)
- Default: **collapsed** (shows a subtle `⌘ Filters` or `▼ Filters` pill).
- Tap/click to expand: slides down with a smooth transition.
- Filter fields:
  - **Date range**: from/to month pickers (default: last 12 months from settings)
  - **District**: multi-select dropdown (populated from `meta.districts`)
  - **Project**: searchable dropdown (populated from `meta.projects`)
  - **Property type**: `Villa | Apartment | Townhouse` (checkboxes)
  - **Layout**: `Studio | 1BR | 2BR | 3BR | 4BR+` (checkboxes)
- Filters stored in `useChartFilters` hook (local state, not persisted).
- On any filter change: all 12 charts re-query DuckDB with new params.

### 12 curated charts (in order)
| # | Chart | Type | Query type |
|---|---|---|---|
| 1 | Average Price per SQM Over Time | Line | `rate_trend` |
| 2 | Number of Sales Over Time | Bar/Line | `volume_trend` |
| 3 | Average Sale Price Over Time | Line | `price_trend` |
| 4 | Off-Plan vs Ready: Price/SQM | Grouped line/bar | `offplan_comparison` (new) |
| 5 | Top Projects by Volume | Horizontal bar | `project_volume` (new) |
| 6 | Average Price per SQM by Project | Horizontal bar | `project_rate` (new) |
| 7 | Sales Volume by Project | Horizontal bar | `project_volume` |
| 8 | Average Sale Price by Layout | Bar | `layout_distribution` |
| 9 | Layout Mix (1BR/2BR/3BR) | Donut/Pie | `layout_mix` (new) |
| 10 | Price per SQM Distribution | Histogram | `rate_distribution` (new) |
| 11 | Price Distribution (Total Price) | Histogram | `price_distribution` (new) |
| 12 | Size vs Price Scatter Plot | Scatter | `size_price_scatter` (new) |

### Per-chart date range
Each chart card has a compact date range selector (two month inputs) in its top-right corner. Changing it re-queries only that chart. Default: inherits from global filter.

### Grid layout
- Desktop: `grid-cols-2 gap-4`
- Mobile: `grid-cols-1`
- Charts 10-12 (distribution/scatter) span full width (`col-span-2` on desktop) as they need more space.

### Data loading
- Charts load independently (no waterfall).
- Each chart has its own `loading | error | data` state.
- Skeleton placeholder while loading.
- Error state shows a retry button.

---

## 6. New Query Types for Chart Tab

The following new `queryType` values need SQL in `queries.js` and handling in `intentToQuery.js`:

- `offplan_comparison` — group by `sale_type` (off-plan / ready), compute avg price/sqm per month
- `project_rate` — group by `project_name`, compute avg price/sqm, order desc, limit 15
- `layout_mix` — group by `rooms`, count transactions
- `rate_distribution` — bucket price/sqm into ranges (0-5k, 5-10k, …), count per bucket
- `price_distribution` — bucket total price into ranges, count per bucket
- `size_price_scatter` — return raw rows: `[{ area_sqm, total_price, project_name }]` (sample, limit 500)

---

## 7. New Hooks & Components

| New file | Purpose |
|---|---|
| `src/hooks/useTheme.js` | Light/dark toggle, persists to localStorage |
| `src/hooks/useSettings.js` | Default date range + future settings, persists to localStorage |
| `src/hooks/useChartFilters.js` | Chart tab filter state (date, district, project, type, layout) |
| `src/hooks/useChartData.js` | Runs a DuckDB query for a single chart, returns `{ data, loading, error, refetch }` |
| `src/components/ThinkingLabel.jsx` | Cycling text animation for loading state |
| `src/components/PlusMenu.jsx` | `+` button with popover menu + date range setting |
| `src/components/SuggestionsOverlay.jsx` | Dropdown of suggested analyses shown on input focus |
| `src/components/ChartTab.jsx` | Chart tab root — filter bar + 12-chart grid |
| `src/components/ChartFilterBar.jsx` | Collapsible filter bar (date, district, project, type, layout) |
| `src/components/charts/OffPlanChart.jsx` | Off-plan vs ready line/bar chart |
| `src/components/charts/HorizontalBarChart.jsx` | Reusable horizontal bar (projects by volume/rate) |
| `src/components/charts/DonutChart.jsx` | Layout mix donut |
| `src/components/charts/HistogramChart.jsx` | Price/sqm and total price distributions |
| `src/components/charts/ScatterChart.jsx` | Size vs price scatter |
| `src/components/charts/InlineDateRange.jsx` | Per-chart date range selector |

---

## 8. Files Modified

| File | Change |
|---|---|
| `src/index.css` | Add `darkMode: 'class'` support, light body bg |
| `tailwind.config.js` or CSS | Enable `dark:` class mode |
| `src/App.jsx` | Add theme context, tab state, useSettings, pass cancel to PostFeed |
| `src/components/ChatInput.jsx` | Pill style, suggestions overlay, `+` menu, stop button |
| `src/components/SmartTopics.jsx` | Remove (absorbed into SuggestionsOverlay) |
| `src/components/PostCard.jsx` | Add cancel button, ThinkingLabel, answer-at-once |
| `src/components/PostFeed.jsx` | Pass `onCancel` down |
| `src/hooks/useAnalysis.js` | Buffer stream (no per-chunk patchPost) |
| `src/utils/queries.js` | Add 6 new query builders |
| `src/utils/intentToQuery.js` | Add routing for 6 new queryTypes |
| `src/components/charts/DynamicChart.jsx` | Add routing for new chart types |

---

## 9. Acceptance Checklist

- [ ] Light mode is the default; dark mode toggled via header button, persisted
- [ ] Input is pill-shaped; `+` opens menu with Date Range option
- [ ] Default date range (last 12 months) injected into every analyze() prompt
- [ ] Focus on input shows suggestions overlay; clicking fills input only
- [ ] Submit button becomes Stop while analyzing
- [ ] Post card shows cycling "Analyzing…/Thinking…" labels while loading
- [ ] ✕ on post card cancels the in-flight request; post is removed
- [ ] Answer appears all at once (no typing effect)
- [ ] Octopus logo in header (PNG or emoji fallback)
- [ ] Feed/Chart tabs work; bottom input bar hidden in Chart tab
- [ ] Chart tab: 12 curated charts in 2-col grid, each loading independently
- [ ] Global filter bar collapses/expands smoothly; changing filters re-queries all charts
- [ ] Per-chart date range re-queries that chart only
- [ ] All existing tests pass
- [ ] Production build succeeds
- [ ] Fully mobile responsive (375px+)
