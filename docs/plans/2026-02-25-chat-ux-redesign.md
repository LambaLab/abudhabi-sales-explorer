# Chat-Based UX Redesign — Abu Dhabi Sales Explorer

**Date:** 2026-02-25
**Status:** Approved, ready for implementation

---

## Overview

Replace the filter-sidebar dashboard with a chat-based research feed. Users type natural language prompts and receive analyst-style text explanations with interactive charts. Each response is a "post card" with its own shareable deeplink. Smart topic chips offer 1-click analyses. Built for single-user v1, designed to extend to a community feed in v2.

---

## Architecture

```
Browser
├── React + Vite (unchanged toolchain)
├── DuckDB-WASM (unchanged — queries 104K rows locally)
├── Post Feed (localStorage, newest first)
└── Chat Input + Smart Topic Chips

       ↕ /api/analyze (intent extraction)
       ↕ /api/explain  (analyst text, streamed)

Vercel Edge Functions
├── /api/analyze — Claude call 1: prompt → structured intent JSON
└── /api/explain — Claude call 2: intent + results → analyst text (streamed)
```

### Data Flow

1. User submits prompt (typed or 1-click topic chip)
2. Browser → `POST /api/analyze` with `{ prompt, meta }` → Claude returns intent JSON
3. Browser converts intent to SQL using existing `queries.js` builders, runs against DuckDB-WASM
4. Browser → `POST /api/explain` with `{ prompt, intent, summaryStats }` → Claude streams analyst text
5. Post card rendered, saved to localStorage, URL updated to `?post=<uuid>`

### API Key Security

`ANTHROPIC_API_KEY` lives in Vercel environment variables only — never shipped to the browser.

---

## UI Layout

Single full-width page, no sidebar, dark theme preserved.

```
┌──────────────────────────────────────────────────────────┐
│  Abu Dhabi Sales Explorer   104,848 transactions  2019–26 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [smart chip] [smart chip] [smart chip] [smart chip]     │
│  [smart chip] [smart chip] [smart chip] [smart chip]     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Ask anything about Abu Dhabi real estate...  [→]  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Post Card (newest first)                   [🔗]   │  │
│  │  ─────────────────────────────────────────────     │  │
│  │  [analyst text — streams in]                       │  │
│  │  [interactive Recharts chart]                      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Deeplink View (`?post=<uuid>`)
Single card centred, no input, "← Back to explorer" link at top.

### Loading State
Post card placeholder appears immediately with progress label ("Analysing data…") and animated skeleton for text + chart area.

---

## Query Types

| Intent | Chart | Example prompt |
|--------|-------|----------------|
| `price_trend` | Line | "Prices in Noya over 2024" |
| `rate_trend` | Line | "Price per sqm on Saadiyat" |
| `volume_trend` | Bar | "How many units sold per month in 2024" |
| `project_comparison` | Multi-line | "Noya Phase 1 vs Yas Acres prices" |
| `district_comparison` | Multi-line | "Al Reem vs Saadiyat vs Yas" |
| `layout_distribution` | Bar | "Breakdown of unit types in Yas Island" |

---

## Post Data Model

```ts
interface Post {
  id: string                          // UUID v4
  createdAt: number                   // Unix ms timestamp
  prompt: string                      // Original user prompt
  title: string                       // Claude short title (≤ 60 chars)
  analysisText: string                // Claude analyst text (2–3 paragraphs)
  intent: {
    queryType: string
    filters: {
      projects?: string[]
      districts?: string[]
      layouts?: string[]
      saleTypes?: string[]
      dateFrom?: string               // YYYY-MM
      dateTo?: string
    }
    chartType: 'line' | 'bar' | 'multiline'
  }
  chartData: Record<string, unknown>[] // DuckDB query results
  chartKeys: string[]                 // Series keys for multi-line charts
}
```

### Storage & Deeplinks

- Posts stored in `localStorage` as `post:<uuid>` keys
- Post index stored as `posts:index` (array of UUIDs, newest first)
- Deeplink URL: `https://app.com/?post=<uuid>&d=<lz-base64>`
  - `d` param = full post JSON compressed with lz-string (~300–800 chars for typical post)
  - Loading: check localStorage first (fast) → fall back to `d` param (cross-device)
  - If neither available: show "Post not found" with option to re-run the original prompt

---

## Vercel Edge Functions

### `POST /api/analyze`

**Input:**
```json
{
  "prompt": "Show 3BR prices in Noya vs Yas Island last year",
  "meta": {
    "projects": ["Noya - Phase 1", "Noya - Phase 2", "..."],
    "districts": ["Yas Island", "Al Reem Island", "..."],
    "layouts": ["1 Bedroom", "2 Bedrooms", "3 Bedrooms", "..."],
    "minDate": "2019-01-01",
    "maxDate": "2026-02-01"
  }
}
```

**System prompt (Claude):**
You are a real estate data query interpreter. Given a user question and lists of available values, return ONLY a JSON object with the structured query intent. Match project names, districts, and layouts exactly from the provided lists using fuzzy matching. For relative dates ("last year", "since 2022") resolve to absolute YYYY-MM strings based on today's date.

**Output:**
```json
{
  "queryType": "project_comparison",
  "filters": {
    "projects": ["Noya - Phase 1"],
    "layouts": ["3 Bedrooms"],
    "compareDistricts": ["Yas Island"],
    "dateFrom": "2025-01",
    "dateTo": "2026-01"
  },
  "chartType": "multiline",
  "title": "3BR Prices: Noya Phase 1 vs Yas Island (2025)"
}
```

### `POST /api/explain`

**Input:**
```json
{
  "prompt": "original user prompt",
  "intent": { "...": "..." },
  "summaryStats": {
    "series": [
      { "name": "Noya - Phase 1", "first": 1950000, "last": 2400000, "pctChange": 23.1, "peak": 2500000, "peakMonth": "2025-11", "txCount": 87 },
      { "name": "Yas Island", "first": 1800000, "last": 2100000, "pctChange": 16.7, "txCount": 312 }
    ],
    "dateRange": { "from": "2025-01", "to": "2026-01" }
  }
}
```

**System prompt (Claude):**
You are a real estate market analyst covering Abu Dhabi. Write 2–3 paragraphs explaining the data in clear, accessible English — as if briefing a sophisticated but non-technical investor. Lead with the most important insight. Use specific numbers (prices in AED, % changes). Compare and contrast where multiple series exist. End with a brief forward-looking observation if the data supports one. Do not use headers or bullet points. Write in flowing prose.

**Output:** Streamed text response (plain text, no markdown).

---

## Smart Topic Chips (8 pre-built)

```
1. "3BR prices: Al Reem vs Yas Island vs Saadiyat"
2. "Transaction volume by district in 2024"
3. "How have off-plan apartment prices trended since 2022?"
4. "Studio price per sqm across Abu Dhabi since 2020"
5. "Most sold projects by volume in 2024"
6. "Noya Phase 1 price trend over the last 2 years"
7. "1BR vs 2BR vs 3BR prices on Yas Island"
8. "Ready vs off-plan price gap since 2021"
```

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Claude can't parse intent | Post card: "Couldn't understand the query. Try: '3BR prices in [project] since [year]'" |
| No data matches filters | Post card: "No transactions found for [applied filters]" with suggestion to broaden |
| API call fails | Retry once automatically, then show error state with retry button |
| Post deeplink not found | "Post not found" with option to re-run original prompt if available in URL |

---

## Files Changed

### New files
- `api/analyze.js` — Edge Function: intent extraction
- `api/explain.js` — Edge Function: analyst text (streaming)
- `src/components/ChatInput.jsx` — prompt textarea + submit
- `src/components/SmartTopics.jsx` — 8 topic chips
- `src/components/PostCard.jsx` — full post: title, text, chart, share button
- `src/components/PostFeed.jsx` — ordered list of PostCards
- `src/components/charts/DynamicChart.jsx` — renders correct chart based on intent.chartType
- `src/hooks/usePostStore.js` — localStorage CRUD + index management
- `src/hooks/useAnalysis.js` — orchestrates /api/analyze → DuckDB → /api/explain
- `src/utils/deeplink.js` — lz-string encode/decode for post URLs
- `src/utils/intentToQuery.js` — converts intent JSON to SQL builder params
- `.env.example` — ANTHROPIC_API_KEY placeholder

### Modified files
- `src/App.jsx` — full rewrite: chat layout
- `vercel.json` — add COOP/COEP headers (already present); add function config if needed
- `package.json` — add `lz-string`, `@anthropic-ai/sdk`
- `src/hooks/useAppData.js` — keep but slim down to just meta query (for /api/analyze payload)

### Deleted files
- `src/components/Sidebar.jsx`
- `src/components/FilterPill.jsx`
- `src/components/DateRangePicker.jsx`
- `src/components/ProjectSearch.jsx`
- `src/hooks/useFilters.js`
- `src/hooks/useChartData.js`

### Preserved unchanged
- `src/utils/db.js` — DuckDB singleton
- `src/utils/queries.js` — SQL builders
- `src/utils/queries.test.js` — tests
- `src/hooks/useDuckDB.js` — DuckDB initialisation hook
- `src/components/charts/MedianPriceChart.jsx`
- `src/components/charts/PricePerSqmChart.jsx`
- `src/components/charts/VolumeChart.jsx`
- `src/components/charts/ProjectComparisonChart.jsx`
- `src/components/charts/ChartCard.jsx`
- `src/index.css` — Tailwind v4 theme
- `vite.config.js`

---

## New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `lz-string` | Compress post JSON for URL deeplinks | ~2 KB gzip |
| `@anthropic-ai/sdk` | Anthropic API client for Edge Functions | ~15 KB |

---

## V2 Community Feed (future)

When ready to add multi-user community feed:
1. Add Supabase (or Planetscale) table with the same Post schema
2. Replace localStorage writes in `usePostStore.js` with API calls
3. Add public feed page showing all users' posts (no auth needed for reading)
4. Optional: anonymous author names ("Explorer #4821")
5. Deeplinks point to backend-stored posts (no more URL encoding needed)

The v1 architecture is designed to make this swap minimal — `usePostStore.js` is the only file that changes.
