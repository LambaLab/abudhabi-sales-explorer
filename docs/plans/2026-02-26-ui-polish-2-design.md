# UI Polish Round 2 — Design Doc

**Date:** 2026-02-26
**Status:** Approved

## Goals

Four targeted improvements:
1. ChatInput unified pill (ChatGPT-style)
2. InlineDateRange preset selector (fix empty inputs)
3. ChartFilterBar always-visible professional strip
4. Analysis hallucination prevention (grounded prompts)

---

## 1. ChatInput — Unified Pill

**File:** `src/components/ChatInput.jsx`

Move `PlusMenu` trigger *inside* the pill. The outer `flex gap-2` wrapper becomes the pill itself.

```
╭──────────────────────────────────────────────────╮
│  +   Ask anything about Abu Dhabi real estate…  ● │
╰──────────────────────────────────────────────────╯
```

- Pill: `rounded-2xl border border-slate-200 bg-white shadow-sm flex items-end`
- Left: `PlusMenu` trigger as a `+` button inside `px-3 py-3` — opens the same popover
- Middle: textarea `flex-1 py-3 pr-2 bg-transparent text-sm focus:outline-none`
- Right: send/stop button `rounded-xl` filled circle, `m-2`
- `SuggestionsOverlay` anchors to the pill's `relative` wrapper (no change needed)

---

## 2. InlineDateRange — Preset Selector

**File:** `src/components/charts/InlineDateRange.jsx`

Replace two bare `type="month"` inputs with a preset dropdown. Custom range only shows text inputs when "custom" is selected.

**Presets:**
| Label | dateFrom | dateTo |
|-------|----------|--------|
| Last 12 months | -12m from today | today |
| Last 2 years | -24m | today |
| Last 3 years | -36m | today |
| All time | `''` | `''` |
| Custom | user input | user input |

- Component derives YYYY-MM strings from selected preset and calls `onChange({ dateFrom, dateTo })`
- No API change to consumers (PostCard, ChartWidget)
- Small `×` reset button appears when a non-default preset is active
- Default: "All time" (empty range) so charts show full data

---

## 3. ChartFilterBar — Always-Visible Strip

**File:** `src/components/ChartFilterBar.jsx`

Remove toggle pill + collapsing panel. Replace with a single always-visible horizontal row, horizontally scrollable on mobile.

**Layout (left → right):**
```
[ 📅 Last 12m ▾ ]  [ All · Ready · Off-Plan ]  [ District ▾ ]  [ Property type ▾ ]  [ Layout ▾ ]  [Clear ×]
```

**Component breakdown:**
- **DatePreset** — same preset logic as InlineDateRange (shared helper); styled as pill dropdown
- **SaleTypeChips** — `All | Ready | Off-Plan` inline toggle buttons; maps to `saleTypes` filter array (`[]` = all, `['Off-Plan']` = off-plan only, `['Ready']` = ready only)
- **FilterDropdown** — reusable single-select `<select>` styled as rounded pill with chevron; used for District, Property type, Layout
- **ClearButton** — shown only when `hasActiveFilters(filters)` is true; resets all filters to defaults
- Active state: `border-accent text-accent bg-accent/5`
- Wrapper: `flex items-center gap-2 overflow-x-auto pb-2 mb-4`

**Data mapping:**
- `dateFrom`/`dateTo` ← DatePreset
- `saleTypes` ← SaleTypeChips
- `districts[0]` ← District dropdown (single-select for simplicity)
- `propertyTypes[0]` ← Property type dropdown
- `layouts[0]` ← Layout dropdown

---

## 4. Analysis Hallucination Prevention

**File:** `api/explain.js`

### System prompt change

Add to the end of both `SHORT_PROMPT` and `FULL_PROMPT`:

> CRITICAL: You must only cite numbers that appear verbatim in the KEY DATA section below. Do not use your training knowledge of Abu Dhabi real estate prices, volumes, or market trends. Every AED figure, percentage, and transaction count you write must come directly from the provided data.

### User message change

Replace `JSON.stringify(summaryStats, null, 2)` with a call to `formatSummaryStats(summaryStats, intent)` — a helper that renders the stats as a labelled plain-text block:

**price_trend / rate_trend example output:**
```
KEY DATA (cite only these numbers):
• Date range: 2022-01 to 2026-02 (49 months)
• Starting value: AED 1,803,564
• Latest value: AED 3,377,165
• Change: +87.2% over the period
• Peak value: AED 3,408,000 (2024-11)
• Total transactions across this period: 46,377
```

**volume_trend example:**
```
KEY DATA (cite only these numbers):
• Date range: 2024-01 to 2025-01
• Total transactions: 12,450
• Monthly average: 1,038
• Peak month: 2024-06 with 1,820 transactions
```

**multi-series example:**
```
KEY DATA (cite only these numbers):
Series: Noya
  • First: AED 1,200,000  |  Latest: AED 1,650,000  |  Change: +37.5%
  • Transactions: 842
Series: Yas Acres
  • First: AED 2,100,000  |  Latest: AED 2,850,000  |  Change: +35.7%
  • Transactions: 1,204
```

The `formatSummaryStats` function lives in `api/explain.js` (server-side only, no client bundle impact).

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ChatInput.jsx` | Unify pill, move PlusMenu inside |
| `src/components/charts/InlineDateRange.jsx` | Full replacement with preset selector |
| `src/components/ChartFilterBar.jsx` | Full replacement with always-visible strip |
| `api/explain.js` | Add hard constraint to prompts + formatSummaryStats helper |
