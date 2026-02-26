# UI Polish Design — 2026-02-26

## Overview

9 targeted UI improvements to the Abu Dhabi Sales Explorer feed and chart experience.
Approved approach: **Hybrid state** — post store holds fetched text, local state handles ephemeral UI preferences.

---

## 1. API & Analysis Layer

### Two-mode `/api/explain` endpoint

`api/explain.js` accepts a `mode` param in the request body: `'short'` | `'full'`.

| Mode | System prompt | max_tokens |
|------|--------------|------------|
| `short` | "Write exactly 2-3 sentences summarizing the single most important insight with specific numbers. No headers, no bullets, flowing prose." | 150 |
| `full` | Existing detailed prompt (2-3 paragraphs, AED numbers, context) | 600 |

### Post model additions

```
shortText   string   — 2-3 sentence summary (shown by default)
fullText    string   — full analysis, fetched on demand (null until requested)
isExpanded  boolean  — whether fullText is visible (default: false)
```

`analysisText` remains as an alias for `shortText` for backwards compatibility with `ReplyCard`.

### `useAnalysis.js` flow

- Initial analysis → calls `mode: 'short'`, stores result in `shortText`
- User clicks "Deeper analysis" → calls `mode: 'full'` with same query context, stores in `fullText`, sets `isExpanded: true`
- Subsequent clicks toggle `isExpanded` (no re-fetch if `fullText` already exists)

---

## 2. Feed UI Changes

### Floating input bar

Remove from the bottom bar wrapper in `App.jsx`:
- `border-t border-slate-200 dark:border-slate-800`
- `bg-white/80 dark:bg-[#0f172a]/95 backdrop-blur`

The `ChatInput` pill floats over feed content with padding only.

### PostCard

- **Remove** the `×` delete button (no `onRemove` prop)
- Show `shortText` by default
- Below analysis text: `"↓ Deeper analysis"` link (chevron-down icon + text)
  - If `fullText` exists → toggle `isExpanded`
  - If not → show inline spinner, fetch `mode: 'full'`, then set `isExpanded: true`
  - When expanded: link becomes `"↑ Less"`
- `PostFeed` and `App.jsx` no longer pass `onRemove`

### ReplyInput

- Font size: `text-sm` (was `text-xs`)
- Icon: chat-bubble-left-ellipsis SVG (replace `↳` text)
- Button: `text-sm font-medium`, more visually prominent

---

## 3. Chart Changes

### Cleaner chart styling (all 4 chart components)

- Remove `<CartesianGrid>` entirely
- Remove `fillOpacity` / area transparency — solid strokes only

Affected: `MedianPriceChart`, `PricePerSqmChart`, `VolumeChart`, `ProjectComparisonChart`

### Chart type toggle (global)

- `useSettings` adds `chartType: 'bar'` to defaults (localStorage-persisted)
- `PlusMenu` adds "Chart Type" row: **Bar** (default) | **Line** two-button toggle
- `DynamicChart` receives `chartType` prop, switches between `<BarChart>` and `<LineChart>` for trend charts
- Comparison/distribution charts remain bar always

### Date range selector (per-post, client-side)

- `InlineDateRange` component above each post's chart
- Shows start/end month dropdowns populated from `chartData` months
- Filters `chartData` in local `useState` — no API call, instant
- Default: full range of fetched data
- State is ephemeral (local to PostCard — resets on navigation, acceptable)

---

## Affected Files

| File | Change |
|------|--------|
| `api/explain.js` | Add `mode` param, split SHORT/FULL prompts |
| `src/hooks/useAnalysis.js` | Pass `mode: 'short'` initially; expose `analyzeDeep` |
| `src/hooks/usePostStore.js` | Add `shortText`, `fullText`, `isExpanded` fields |
| `src/hooks/useSettings.js` | Add `chartType: 'bar'` to defaults |
| `src/App.jsx` | Remove floating bar styles; remove `onRemove` |
| `src/components/PostCard.jsx` | Remove delete btn; add "Deeper analysis" link; add InlineDateRange |
| `src/components/PostFeed.jsx` | Remove `onRemove` prop passing |
| `src/components/ReplyCard.jsx` | Update to use `shortText` alias |
| `src/components/ReplyInput.jsx` | Bigger font, new icon |
| `src/components/PlusMenu.jsx` | Add chart type toggle |
| `src/components/charts/DynamicChart.jsx` | Accept `chartType` prop; pass to charts |
| `src/components/charts/MedianPriceChart.jsx` | Remove CartesianGrid; support bar/line |
| `src/components/charts/PricePerSqmChart.jsx` | Remove CartesianGrid; support bar/line |
| `src/components/charts/VolumeChart.jsx` | Remove CartesianGrid |
| `src/components/charts/ProjectComparisonChart.jsx` | Remove CartesianGrid |
| `src/components/InlineDateRange.jsx` | New component — month range picker |
