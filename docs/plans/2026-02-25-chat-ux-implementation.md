# Chat-Based UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the filter-sidebar dashboard with a chat feed where users type natural language prompts and get analyst text + interactive charts, each with a shareable deeplink.

**Architecture:** Browser calls two Vercel Edge Functions per query — `/api/analyze` extracts structured intent from the prompt via Claude, then DuckDB-WASM runs the SQL locally, then `/api/explain` streams analyst prose back. Posts persist in `localStorage` and deeplinks encode the full post in the URL via lz-string so they work cross-device.

**Tech Stack:** Vite + React 19, DuckDB-WASM, Recharts, Tailwind v4, Anthropic SDK (Edge Functions), lz-string, Vitest

---

## Reference: key files that must NOT change

- `src/utils/db.js` — DuckDB singleton, leave intact
- `src/hooks/useDuckDB.js` — DuckDB init hook, leave intact
- `src/components/charts/MedianPriceChart.jsx` — reused as-is
- `src/components/charts/PricePerSqmChart.jsx` — reused as-is
- `src/components/charts/VolumeChart.jsx` — reused as-is
- `src/components/charts/ProjectComparisonChart.jsx` — reused as-is (but its `projects` prop renamed to `seriesKeys`)
- `src/components/charts/ChartCard.jsx` — reused as-is
- `src/index.css` — Tailwind v4 theme, leave intact
- `vite.config.js` — leave intact

---

## Task 1: Install new dependencies + environment setup

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `.env.local` (gitignored)

**Step 1: Install lz-string and Anthropic SDK**

```bash
cd /Users/nagi/abudhabi-sales-explorer
npm install lz-string @anthropic-ai/sdk
```

Expected: both appear in `package.json` dependencies.

**Step 2: Create `.env.example`**

```
# Copy this file to .env.local and fill in your key
# In Vercel: add this under Settings → Environment Variables
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Step 3: Create `.env.local`** (add real key, this file is gitignored)

```
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_REAL_KEY_HERE
```

**Step 4: Verify `.gitignore` already excludes `.env.local`**

```bash
grep ".env" /Users/nagi/abudhabi-sales-explorer/.gitignore
```

If `.env.local` is not listed, add it:
```
.env.local
.env*.local
```

**Step 5: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add package.json package-lock.json .env.example .gitignore
git commit -m "feat: add lz-string and anthropic-sdk dependencies"
```

---

## Task 2: Add two new SQL query builders (TDD)

New query types `district_comparison` and `layout_distribution` need SQL builders parallel to the existing `buildProjectComparisonQuery`.

**Files:**
- Modify: `src/utils/queries.js`
- Modify: `src/utils/queries.test.js`

**Step 1: Write the failing tests first**

Add to the bottom of `src/utils/queries.test.js`:

```js
import { buildDistrictComparisonQuery, buildLayoutComparisonQuery } from './queries'

describe('buildDistrictComparisonQuery', () => {
  it('returns empty sql when no districts', () => {
    const { sql } = buildDistrictComparisonQuery({ districts: [] })
    expect(sql).toBe('')
  })

  it('returns SQL grouped by district', () => {
    const { sql, params } = buildDistrictComparisonQuery({
      districts: ['Yas Island', 'Al Reem Island'],
      dateFrom: '2024-01',
      dateTo:   '2025-01',
    })
    expect(sql).toContain('district')
    expect(sql).toContain('GROUP BY month, district')
    expect(sql).toContain('MEDIAN(price_aed)')
    expect(params).toContain('Yas Island')
    expect(params).toContain('Al Reem Island')
    expect(params).toContain('2024-01')
  })
})

describe('buildLayoutComparisonQuery', () => {
  it('returns empty sql when no layouts', () => {
    const { sql } = buildLayoutComparisonQuery({ layouts: [] })
    expect(sql).toBe('')
  })

  it('returns SQL grouped by layout', () => {
    const { sql, params } = buildLayoutComparisonQuery({
      layouts: ['1 Bedroom', '2 Bedrooms', '3 Bedrooms'],
    })
    expect(sql).toContain('layout')
    expect(sql).toContain('GROUP BY month, layout')
    expect(sql).toContain('MEDIAN(price_aed)')
    expect(params).toContain('1 Bedroom')
  })

  it('accepts optional district and project filters', () => {
    const { sql, params } = buildLayoutComparisonQuery({
      layouts: ['Studio'],
      districts: ['Yas Island'],
    })
    expect(sql).toContain('district IN')
    expect(params).toContain('Yas Island')
    expect(params).toContain('Studio')
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd /Users/nagi/abudhabi-sales-explorer && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `buildDistrictComparisonQuery is not a function`

**Step 3: Implement the two new builders**

Add to the bottom of `src/utils/queries.js` (before the closing):

```js
/**
 * Monthly median price grouped by district (for district comparison chart)
 */
export function buildDistrictComparisonQuery({ districts = [], dateFrom, dateTo }) {
  if (!districts.length) return { sql: '', params: [] }
  const conditions = []
  const params = []
  if (dateFrom) { conditions.push('sale_date >= ?'); params.push(dateFrom) }
  if (dateTo)   { conditions.push('sale_date <= ?'); params.push(dateTo) }
  conditions.push(`district IN (${districts.map(() => '?').join(',')})`)
  params.push(...districts)
  conditions.push('price_aed > 0')
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')   AS month,
      district,
      MEDIAN(price_aed)               AS median_price,
      CAST(COUNT(*) AS INTEGER)       AS tx_count
    FROM sales
    WHERE ${conditions.join(' AND ')}
    GROUP BY month, district
    ORDER BY month
  `
  return { sql, params }
}

/**
 * Monthly median price grouped by layout (for layout comparison chart)
 * Optional district/project filters to scope the data
 */
export function buildLayoutComparisonQuery({ layouts = [], districts = [], projects = [], dateFrom, dateTo }) {
  if (!layouts.length) return { sql: '', params: [] }
  const conditions = []
  const params = []
  if (dateFrom) { conditions.push('sale_date >= ?'); params.push(dateFrom) }
  if (dateTo)   { conditions.push('sale_date <= ?'); params.push(dateTo) }
  if (districts.length) {
    conditions.push(`district IN (${districts.map(() => '?').join(',')})`)
    params.push(...districts)
  }
  if (projects.length) {
    conditions.push(`project_name IN (${projects.map(() => '?').join(',')})`)
    params.push(...projects)
  }
  conditions.push(`layout IN (${layouts.map(() => '?').join(',')})`)
  params.push(...layouts)
  conditions.push('price_aed > 0')
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')   AS month,
      layout,
      MEDIAN(price_aed)               AS median_price,
      CAST(COUNT(*) AS INTEGER)       AS tx_count
    FROM sales
    WHERE ${conditions.join(' AND ')}
    GROUP BY month, layout
    ORDER BY month
  `
  return { sql, params }
}
```

**Step 4: Run tests to confirm they pass**

```bash
cd /Users/nagi/abudhabi-sales-explorer && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: All tests PASS (10+ tests now).

**Step 5: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/utils/queries.js src/utils/queries.test.js
git commit -m "feat: add district and layout comparison SQL query builders"
```

---

## Task 3: Create `intentToQuery.js` utility (TDD)

Converts Claude's intent JSON → SQL `{sql, params}` using the right query builder, and pivots multi-series results into the shape Recharts expects.

**Files:**
- Create: `src/utils/intentToQuery.js`
- Create: `src/utils/intentToQuery.test.js`

**Step 1: Write the failing tests**

Create `src/utils/intentToQuery.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { intentToQuery, pivotChartData, computeSummaryStats } from './intentToQuery'

describe('intentToQuery', () => {
  it('price_trend maps to monthly price query', () => {
    const { sql, params } = intentToQuery({
      queryType: 'price_trend',
      filters: { dateFrom: '2024-01', dateTo: '2025-01', districts: ['Yas Island'] },
    })
    expect(sql).toContain('median_price')
    expect(sql).toContain('GROUP BY month')
    expect(params).toContain('Yas Island')
  })

  it('rate_trend maps to rate-per-sqm query', () => {
    const { sql } = intentToQuery({
      queryType: 'rate_trend',
      filters: {},
    })
    expect(sql).toContain('median_rate')
  })

  it('volume_trend maps to volume query', () => {
    const { sql } = intentToQuery({
      queryType: 'volume_trend',
      filters: {},
    })
    expect(sql).toContain('tx_count')
    expect(sql).not.toContain('median_price')
  })

  it('project_comparison maps to project comparison query', () => {
    const { sql, params } = intentToQuery({
      queryType: 'project_comparison',
      filters: { projects: ['Noya - Phase 1', 'Yas Acres'] },
    })
    expect(sql).toContain('project_name')
    expect(params).toContain('Noya - Phase 1')
  })

  it('district_comparison maps to district comparison query', () => {
    const { sql, params } = intentToQuery({
      queryType: 'district_comparison',
      filters: { districts: ['Yas Island', 'Al Reem Island'] },
    })
    expect(sql).toContain('GROUP BY month, district')
    expect(params).toContain('Yas Island')
  })

  it('layout_distribution maps to layout comparison query', () => {
    const { sql, params } = intentToQuery({
      queryType: 'layout_distribution',
      filters: { layouts: ['1 Bedroom', '2 Bedrooms'], districts: ['Yas Island'] },
    })
    expect(sql).toContain('GROUP BY month, layout')
    expect(params).toContain('1 Bedroom')
  })

  it('falls back to price_trend for unknown queryType', () => {
    const { sql } = intentToQuery({ queryType: 'unknown', filters: {} })
    expect(sql).toContain('median_price')
  })
})

describe('pivotChartData', () => {
  const projectRows = [
    { month: '2024-01', project_name: 'Noya - Phase 1', median_price: 2000000, tx_count: 10 },
    { month: '2024-01', project_name: 'Yas Acres',       median_price: 1500000, tx_count: 5 },
    { month: '2024-02', project_name: 'Noya - Phase 1', median_price: 2100000, tx_count: 8 },
    { month: '2024-02', project_name: 'Yas Acres',       median_price: 1600000, tx_count: 6 },
  ]

  it('pivots project rows into {month, ProjectA, ProjectB} shape', () => {
    const { chartData, chartKeys } = pivotChartData(projectRows, { queryType: 'project_comparison' })
    expect(chartData).toHaveLength(2)
    expect(chartData[0].month).toBe('2024-01')
    expect(chartData[0]['Noya - Phase 1']).toBe(2000000)
    expect(chartData[0]['Yas Acres']).toBe(1500000)
    expect(chartKeys).toContain('Noya - Phase 1')
    expect(chartKeys).toContain('Yas Acres')
  })

  it('returns flat rows unchanged for price_trend', () => {
    const rows = [{ month: '2024-01', median_price: 2000000, tx_count: 10 }]
    const { chartData, chartKeys } = pivotChartData(rows, { queryType: 'price_trend' })
    expect(chartData).toEqual(rows)
    expect(chartKeys).toEqual([])
  })

  it('pivots district rows using district key', () => {
    const rows = [
      { month: '2024-01', district: 'Yas Island', median_price: 1800000, tx_count: 20 },
      { month: '2024-01', district: 'Al Reem Island', median_price: 2200000, tx_count: 30 },
    ]
    const { chartData } = pivotChartData(rows, { queryType: 'district_comparison' })
    expect(chartData[0]['Yas Island']).toBe(1800000)
    expect(chartData[0]['Al Reem Island']).toBe(2200000)
  })
})

describe('computeSummaryStats', () => {
  it('computes pctChange for price_trend', () => {
    const rows = [
      { month: '2024-01', median_price: 2000000, tx_count: 10 },
      { month: '2024-06', median_price: 2400000, tx_count: 12 },
    ]
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series[0].pctChange).toBe(20)
    expect(stats.series[0].first).toBe(2000000)
    expect(stats.series[0].last).toBe(2400000)
  })

  it('computes totalTransactions for volume_trend', () => {
    const rows = [
      { month: '2024-01', tx_count: 100 },
      { month: '2024-02', tx_count: 150 },
    ]
    const stats = computeSummaryStats(rows, { queryType: 'volume_trend' })
    expect(stats.totalTransactions).toBe(250)
    expect(stats.peakCount).toBe(150)
    expect(stats.peakMonth).toBe('2024-02')
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd /Users/nagi/abudhabi-sales-explorer && npm test -- --reporter=verbose 2>&1 | tail -15
```

Expected: FAIL — `intentToQuery is not a function`

**Step 3: Implement `src/utils/intentToQuery.js`**

```js
import {
  buildMonthlyPriceQuery,
  buildPricePerSqmQuery,
  buildVolumeQuery,
  buildProjectComparisonQuery,
  buildDistrictComparisonQuery,
  buildLayoutComparisonQuery,
} from './queries.js'

/**
 * Convert Claude's structured intent into a DuckDB { sql, params } pair.
 */
export function intentToQuery(intent) {
  const { queryType, filters = {} } = intent
  const { projects = [], districts = [], layouts = [], saleTypes = [], dateFrom, dateTo } = filters

  switch (queryType) {
    case 'price_trend':
      return buildMonthlyPriceQuery({ projects, districts, layouts, saleTypes, dateFrom, dateTo })

    case 'rate_trend':
      return buildPricePerSqmQuery({ projects, districts, layouts, saleTypes, dateFrom, dateTo })

    case 'volume_trend':
      return buildVolumeQuery({ projects, districts, layouts, saleTypes, dateFrom, dateTo })

    case 'project_comparison':
      return buildProjectComparisonQuery({ projectNames: projects, dateFrom, dateTo })

    case 'district_comparison':
      return buildDistrictComparisonQuery({ districts, dateFrom, dateTo })

    case 'layout_distribution':
      return buildLayoutComparisonQuery({ layouts, districts, projects, dateFrom, dateTo })

    default:
      return buildMonthlyPriceQuery({ dateFrom, dateTo })
  }
}

/**
 * Pivot multi-series DuckDB rows into the shape Recharts expects:
 * [{ month, 'SeriesA': value, 'SeriesB': value }]
 *
 * For single-series queryTypes (price_trend, rate_trend, volume_trend)
 * rows are returned unchanged.
 */
export function pivotChartData(rows, intent) {
  const { queryType } = intent

  const PIVOT_KEY = {
    project_comparison:  'project_name',
    district_comparison: 'district',
    layout_distribution: 'layout',
  }[queryType]

  if (!PIVOT_KEY) return { chartData: rows, chartKeys: [] }

  const byMonth = {}
  const keys = new Set()

  rows.forEach(row => {
    const seriesName = String(row[PIVOT_KEY])
    if (!byMonth[row.month]) byMonth[row.month] = { month: row.month }
    byMonth[row.month][seriesName] = Math.round(Number(row.median_price))
    keys.add(seriesName)
  })

  return {
    chartData: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
    chartKeys: [...keys],
  }
}

/**
 * Compute summary statistics from raw DuckDB rows for the Claude /api/explain call.
 */
export function computeSummaryStats(rows, intent) {
  const { queryType } = intent

  if (queryType === 'volume_trend') {
    const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))
    const counts = sorted.map(r => Number(r.tx_count))
    const peak = Math.max(...counts)
    const peakRow = sorted.find(r => Number(r.tx_count) === peak)
    return {
      totalTransactions: counts.reduce((a, b) => a + b, 0),
      avgMonthly: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
      peakMonth: peakRow?.month,
      peakCount: peak,
      dateRange: { from: sorted[0]?.month, to: sorted[sorted.length - 1]?.month },
    }
  }

  const PIVOT_KEY = {
    project_comparison:  'project_name',
    district_comparison: 'district',
    layout_distribution: 'layout',
  }[queryType]

  if (PIVOT_KEY) {
    // Multi-series: group rows by series name
    const seriesMap = {}
    rows.forEach(row => {
      const key = String(row[PIVOT_KEY])
      if (!seriesMap[key]) seriesMap[key] = []
      seriesMap[key].push({ month: row.month, price: Number(row.median_price), count: Number(row.tx_count) })
    })
    const series = Object.entries(seriesMap).map(([name, points]) => {
      const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month))
      const first = sorted[0]?.price
      const last  = sorted[sorted.length - 1]?.price
      const peak  = Math.max(...sorted.map(p => p.price))
      const peakPoint = sorted.find(p => p.price === peak)
      return {
        name,
        first:     Math.round(first),
        last:      Math.round(last),
        pctChange: first ? Math.round((last - first) / first * 1000) / 10 : 0,
        peak:      Math.round(peak),
        peakMonth: peakPoint?.month,
        txCount:   sorted.reduce((a, b) => a + b.count, 0),
      }
    })
    const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))
    return { series, dateRange: { from: sorted[0]?.month, to: sorted[sorted.length - 1]?.month } }
  }

  // price_trend / rate_trend — single series
  const valueKey = queryType === 'rate_trend' ? 'median_rate' : 'median_price'
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))
  const values = sorted.map(r => Number(r[valueKey])).filter(v => v > 0)
  const first  = values[0]
  const last   = values[values.length - 1]
  const peak   = Math.max(...values)
  const peakRow = sorted.find(r => Number(r[valueKey]) === peak)
  return {
    series: [{
      name:      'All',
      first:     Math.round(first),
      last:      Math.round(last),
      pctChange: first ? Math.round((last - first) / first * 1000) / 10 : 0,
      peak:      Math.round(peak),
      peakMonth: peakRow?.month,
      txCount:   sorted.reduce((a, b) => a + Number(b.tx_count), 0),
    }],
    dateRange: { from: sorted[0]?.month, to: sorted[sorted.length - 1]?.month },
  }
}
```

**Step 4: Run tests to confirm they pass**

```bash
cd /Users/nagi/abudhabi-sales-explorer && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: All tests PASS (20+ tests).

**Step 5: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/utils/intentToQuery.js src/utils/intentToQuery.test.js
git commit -m "feat: add intentToQuery, pivotChartData, and computeSummaryStats utilities"
```

---

## Task 4: Create `deeplink.js` utility (TDD)

Encodes a full post as a compressed URL-safe string so deeplinks work cross-device (no backend needed in v1).

**Files:**
- Create: `src/utils/deeplink.js`
- Create: `src/utils/deeplink.test.js`

**Step 1: Write failing tests**

Create `src/utils/deeplink.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { encodePost, decodePost } from './deeplink'

const SAMPLE_POST = {
  id: 'abc123',
  createdAt: 1700000000000,
  prompt: 'Show 3BR prices in Noya vs Yas Island last year',
  title: '3BR Prices: Noya vs Yas Island (2025)',
  analysisText: 'The median 3-bedroom price in Noya Phase 1 climbed significantly.',
  intent: { queryType: 'project_comparison', filters: { projects: ['Noya - Phase 1'] }, chartType: 'multiline' },
  chartData: [{ month: '2025-01', 'Noya - Phase 1': 2400000, 'Yas Island': 1900000 }],
  chartKeys: ['Noya - Phase 1', 'Yas Island'],
}

describe('encodePost / decodePost', () => {
  it('round-trips a post object through encode → decode', () => {
    const encoded = encodePost(SAMPLE_POST)
    const decoded = decodePost(encoded)
    expect(decoded).toEqual(SAMPLE_POST)
  })

  it('encoded string is a non-empty string', () => {
    const encoded = encodePost(SAMPLE_POST)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(10)
  })

  it('decoded string is shorter than raw JSON', () => {
    const encoded = encodePost(SAMPLE_POST)
    const rawJson = JSON.stringify(SAMPLE_POST)
    // lz-string compression should reduce size
    expect(encoded.length).toBeLessThan(rawJson.length)
  })

  it('returns null for invalid/corrupt encoded string', () => {
    const result = decodePost('this-is-not-valid-lz-data!!!!')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(decodePost('')).toBeNull()
    expect(decodePost(null)).toBeNull()
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd /Users/nagi/abudhabi-sales-explorer && npm test -- --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL — `encodePost is not a function`

**Step 3: Implement `src/utils/deeplink.js`**

```js
import LZString from 'lz-string'

/**
 * Compress and base64url-encode a post object for use in URL query params.
 * Example: ?post=abc123&d=<encodePost(post)>
 */
export function encodePost(post) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(post))
}

/**
 * Decode a previously encoded post. Returns null if input is invalid.
 */
export function decodePost(encoded) {
  if (!encoded) return null
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Build a shareable URL for a post.
 * Encodes the full post in the URL so it works on any device without a backend.
 */
export function buildShareUrl(post) {
  const base = window.location.origin + window.location.pathname
  const params = new URLSearchParams({ post: post.id, d: encodePost(post) })
  return `${base}?${params.toString()}`
}

/**
 * Parse a post from the current URL (for deeplink landing).
 * Returns { postId, post } where post may be null if no 'd' param.
 */
export function parseShareUrl() {
  const params = new URLSearchParams(window.location.search)
  const postId = params.get('post')
  const d      = params.get('d')
  const post   = d ? decodePost(d) : null
  return { postId, post }
}
```

**Step 4: Run tests**

```bash
cd /Users/nagi/abudhabi-sales-explorer && npm test -- --reporter=verbose 2>&1 | tail -15
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/utils/deeplink.js src/utils/deeplink.test.js
git commit -m "feat: add deeplink encode/decode utility using lz-string"
```

---

## Task 5: Create `usePostStore.js` hook (TDD)

Manages post persistence in `localStorage`. This is the only file that changes in v2 when we add a database.

**Files:**
- Create: `src/hooks/usePostStore.js`
- Create: `src/hooks/usePostStore.test.js`

**Step 1: Write failing tests**

Create `src/hooks/usePostStore.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePostStore } from './usePostStore'

// jsdom provides localStorage automatically in test environment

beforeEach(() => {
  localStorage.clear()
})

const makePost = (id = 'p1') => ({
  id,
  createdAt: Date.now(),
  prompt: 'Test prompt',
  title: 'Test title',
  analysisText: 'Test analysis',
  intent: { queryType: 'price_trend', filters: {}, chartType: 'line' },
  chartData: [],
  chartKeys: [],
})

describe('usePostStore', () => {
  it('starts with empty posts', () => {
    const { result } = renderHook(() => usePostStore())
    expect(result.current.posts).toEqual([])
  })

  it('addPost adds a post and it appears in posts list', () => {
    const { result } = renderHook(() => usePostStore())
    const post = makePost('p1')
    act(() => result.current.addPost(post))
    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].id).toBe('p1')
  })

  it('newest posts appear first', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost('p1')))
    act(() => result.current.addPost(makePost('p2')))
    expect(result.current.posts[0].id).toBe('p2')
    expect(result.current.posts[1].id).toBe('p1')
  })

  it('getPost returns post by id', () => {
    const { result } = renderHook(() => usePostStore())
    const post = makePost('abc')
    act(() => result.current.addPost(post))
    const found = result.current.getPost('abc')
    expect(found?.id).toBe('abc')
  })

  it('getPost returns undefined for unknown id', () => {
    const { result } = renderHook(() => usePostStore())
    expect(result.current.getPost('nope')).toBeUndefined()
  })

  it('removePost removes a post from the list', () => {
    const { result } = renderHook(() => usePostStore())
    act(() => result.current.addPost(makePost('p1')))
    act(() => result.current.addPost(makePost('p2')))
    act(() => result.current.removePost('p1'))
    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].id).toBe('p2')
  })

  it('persists posts across hook re-mounts (localStorage)', () => {
    const { result: r1, unmount } = renderHook(() => usePostStore())
    act(() => r1.current.addPost(makePost('p1')))
    unmount()
    const { result: r2 } = renderHook(() => usePostStore())
    expect(r2.current.posts).toHaveLength(1)
    expect(r2.current.posts[0].id).toBe('p1')
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd /Users/nagi/abudhabi-sales-explorer && npm test -- --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL — `usePostStore is not a function`

**Step 3: Implement `src/hooks/usePostStore.js`**

```js
import { useState, useCallback } from 'react'

const STORAGE_KEY = 'ad_posts_v1'

function loadPosts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePosts(posts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

export function usePostStore() {
  const [posts, setPosts] = useState(() => loadPosts())

  const addPost = useCallback((post) => {
    setPosts(prev => {
      const next = [post, ...prev.filter(p => p.id !== post.id)]
      savePosts(next)
      return next
    })
  }, [])

  const removePost = useCallback((id) => {
    setPosts(prev => {
      const next = prev.filter(p => p.id !== id)
      savePosts(next)
      return next
    })
  }, [])

  const getPost = useCallback((id) => {
    return loadPosts().find(p => p.id === id)
  }, [])

  return { posts, addPost, removePost, getPost }
}
```

**Step 4: Run all tests**

```bash
cd /Users/nagi/abudhabi-sales-explorer && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/hooks/usePostStore.js src/hooks/usePostStore.test.js
git commit -m "feat: add usePostStore hook with localStorage persistence"
```

---

## Task 6: Create Vercel Edge Function `/api/analyze`

Calls Claude to convert a natural language prompt into structured query intent JSON.

**Files:**
- Create: `api/analyze.js`

**Step 1: Create `api/analyze.js`**

```js
import Anthropic from '@anthropic-ai/sdk'

export const config = { runtime: 'edge' }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a real estate data query interpreter for Abu Dhabi property transactions.
Given a user's question and lists of available values, return ONLY a valid JSON object with the structured query intent.
Rules:
- Match project names, districts, and layouts EXACTLY from the provided lists (fuzzy match: "Noya" → "Noya - Phase 1")
- For relative dates ("last year", "since 2022", "last 3 years") resolve to absolute YYYY-MM strings
- "last year" means the 12 months before today
- "since 2022" means dateFrom = "2022-01"
- chartType must be "line" for trends, "bar" for counts/distributions, "multiline" for comparisons
- queryType options: price_trend, rate_trend, volume_trend, project_comparison, district_comparison, layout_distribution
- If comparing specific named projects → project_comparison
- If comparing districts → district_comparison
- If comparing bedroom types/layouts → layout_distribution
- title must be under 60 characters`

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { prompt, meta } = body
  if (!prompt || !meta) {
    return new Response(JSON.stringify({ error: 'Missing prompt or meta' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const today = new Date().toISOString().split('T')[0]

  const userMessage = `Question: "${prompt}"

Available data values:
- Projects (sample of first 60): ${meta.projects.slice(0, 60).join(', ')}
- Districts: ${meta.districts.join(', ')}
- Layouts: ${meta.layouts.join(', ')}
- Data covers: ${meta.minDate} to ${meta.maxDate}
- Today's date: ${today}

Return ONLY this JSON structure (no markdown, no explanation):
{
  "queryType": "<price_trend|rate_trend|volume_trend|project_comparison|district_comparison|layout_distribution>",
  "filters": {
    "projects": [],
    "districts": [],
    "layouts": [],
    "saleTypes": [],
    "dateFrom": "<YYYY-MM or null>",
    "dateTo": "<YYYY-MM or null>"
  },
  "chartType": "<line|bar|multiline>",
  "title": "<max 60 chars>"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = message.content[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Could not parse intent from Claude response' }), { status: 422, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(jsonMatch[0], {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? 'Claude API error' }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }
}
```

**Step 2: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add api/analyze.js
git commit -m "feat: add /api/analyze Edge Function for intent extraction"
```

---

## Task 7: Create Vercel Edge Function `/api/explain`

Streams analyst prose from Claude given query results summary.

**Files:**
- Create: `api/explain.js`

**Step 1: Create `api/explain.js`**

```js
import Anthropic from '@anthropic-ai/sdk'

export const config = { runtime: 'edge' }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a real estate market analyst specializing in Abu Dhabi property.
Write clear, accessible analysis for sophisticated investors.
Rules:
- Write exactly 2-3 paragraphs of flowing prose — NO headers, NO bullet points, NO markdown
- Lead with the single most important insight
- Use specific AED numbers and percentages
- Compare and contrast when multiple series exist
- End with a brief forward-looking observation if the data supports one
- Keep language accessible to non-experts while remaining precise`

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { prompt, intent, summaryStats } = await req.json()

  const userMessage = `Original question: "${prompt}"

Query type: ${intent.queryType}
Filters applied: ${JSON.stringify(intent.filters)}

Key data:
${JSON.stringify(summaryStats, null, 2)}

Write the analyst commentary now.`

  const stream = anthropic.messages.stream({
    model: 'claude-opus-4-5',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
```

**Step 2: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add api/explain.js
git commit -m "feat: add /api/explain Edge Function for streaming analyst text"
```

---

## Task 8: Create `useAnalysis.js` hook

Orchestrates the full analysis pipeline: `/api/analyze` → DuckDB → `/api/explain` → post saved.

**Files:**
- Create: `src/hooks/useAnalysis.js`

**Note on local development:** The `/api/*` routes only work when running `vercel dev` (not plain `npm run dev`). To install the Vercel CLI: `npm install -g vercel && vercel login`. Then run `vercel dev` instead of `npm run dev`. Update `.claude/launch.json` port to `3000` for the dev config.

**Step 1: Create `src/hooks/useAnalysis.js`**

```js
import { useState, useCallback } from 'react'
import { query } from '../utils/db'
import { intentToQuery, pivotChartData, computeSummaryStats } from '../utils/intentToQuery'
import { usePostStore } from './usePostStore'

function uuid() {
  return crypto.randomUUID()
}

async function fetchIntent(prompt, meta) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, meta }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

async function streamExplain(prompt, intent, summaryStats, onChunk) {
  const res = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, intent, summaryStats }),
  })
  if (!res.ok) throw new Error(`Explain API error: ${res.status}`)

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    onChunk(chunk)
  }
  return full
}

export function useAnalysis(meta) {
  const { addPost } = usePostStore()
  const [status, setStatus]   = useState('idle')   // idle | analyzing | querying | explaining | done | error
  const [error, setError]     = useState(null)
  const [pendingPost, setPendingPost] = useState(null)

  const analyze = useCallback(async (prompt) => {
    if (!meta) return
    setStatus('analyzing')
    setError(null)
    setPendingPost(null)

    try {
      // Step 1: Get intent from Claude
      const intent = await fetchIntent(prompt, meta)

      setStatus('querying')

      // Step 2: Run DuckDB query
      const { sql, params } = intentToQuery(intent)
      if (!sql) throw new Error('No SQL generated for this query type')
      const rawRows = await query(sql, params)

      // Step 3: Pivot data for chart + compute summary stats
      const { chartData, chartKeys } = pivotChartData(rawRows, intent)
      const summaryStats = computeSummaryStats(rawRows, intent)

      // Step 4: Stream analyst text from Claude
      setStatus('explaining')
      const postId = uuid()
      // Create a placeholder post that the UI shows while text streams in
      const placeholder = {
        id:           postId,
        createdAt:    Date.now(),
        prompt,
        title:        intent.title ?? prompt.slice(0, 60),
        analysisText: '',
        intent,
        chartData,
        chartKeys,
        isStreaming:  true,
      }
      setPendingPost(placeholder)

      let fullText = ''
      await streamExplain(prompt, intent, summaryStats, (chunk) => {
        fullText += chunk
        setPendingPost(prev => prev ? { ...prev, analysisText: fullText } : prev)
      })

      // Step 5: Finalise post
      const finalPost = { ...placeholder, analysisText: fullText, isStreaming: false }
      setPendingPost(null)
      addPost(finalPost)
      setStatus('done')
    } catch (err) {
      setError(err.message ?? 'Something went wrong')
      setStatus('error')
      setPendingPost(null)
    }
  }, [meta, addPost])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setPendingPost(null)
  }, [])

  return { analyze, status, error, pendingPost, reset }
}
```

**Step 2: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/hooks/useAnalysis.js
git commit -m "feat: add useAnalysis hook orchestrating analyze → DuckDB → explain pipeline"
```

---

## Task 9: Create `DynamicChart.jsx`

Picks the right existing chart component based on the post's `intent.queryType`.

**Files:**
- Create: `src/components/charts/DynamicChart.jsx`
- Modify: `src/components/charts/ProjectComparisonChart.jsx` — rename `projects` prop to `seriesKeys`

**Step 1: Update `ProjectComparisonChart.jsx` to accept `seriesKeys` prop**

Open `src/components/charts/ProjectComparisonChart.jsx`. Find:

```js
export function ProjectComparisonChart({ data, projects }) {
  const isEmpty = !data || !Array.isArray(data) || data.length === 0 || !projects.length
```

Change `projects` → `seriesKeys` throughout the file (3 occurrences):
- Function signature: `{ data, seriesKeys = [] }`
- `isEmpty` check: `!seriesKeys.length`
- subtitle string: `seriesKeys.length`
- The `.map()` at the bottom: `seriesKeys.map((key, i) => ...)`

Also fix the import: the component currently imports `COLORS` from `'../ProjectSearch'`. Since we're deleting `ProjectSearch.jsx`, move the COLORS array into this file instead:

```js
// Add at top of file, remove the import line
const COLORS = ['#e94560','#38bdf8','#a78bfa','#34d399','#fb923c','#f472b6','#facc15','#60a5fa']
```

**Step 2: Create `src/components/charts/DynamicChart.jsx`**

```js
import { MedianPriceChart }      from './MedianPriceChart'
import { PricePerSqmChart }      from './PricePerSqmChart'
import { VolumeChart }           from './VolumeChart'
import { ProjectComparisonChart } from './ProjectComparisonChart'

/**
 * Renders the correct chart component based on the post's queryType.
 * All multi-series types (project_comparison, district_comparison, layout_distribution)
 * use ProjectComparisonChart since they all produce the same pivoted data shape.
 */
export function DynamicChart({ intent, chartData, chartKeys }) {
  const { queryType } = intent ?? {}

  if (queryType === 'rate_trend') {
    return <PricePerSqmChart data={chartData} />
  }
  if (queryType === 'volume_trend') {
    return <VolumeChart data={chartData} />
  }
  if (['project_comparison', 'district_comparison', 'layout_distribution'].includes(queryType)) {
    return <ProjectComparisonChart data={chartData} seriesKeys={chartKeys} />
  }
  // Default: price_trend and anything else
  return <MedianPriceChart data={chartData} />
}
```

**Step 3: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/components/charts/DynamicChart.jsx src/components/charts/ProjectComparisonChart.jsx
git commit -m "feat: add DynamicChart and update ProjectComparisonChart to use seriesKeys prop"
```

---

## Task 10: Create `ChatInput.jsx`

The prompt input bar at the top of the page.

**Files:**
- Create: `src/components/ChatInput.jsx`

**Step 1: Create `src/components/ChatInput.jsx`**

```jsx
import { useState } from 'react'

export function ChatInput({ onSubmit, isLoading }) {
  const [value, setValue] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSubmit(trimmed)
    setValue('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about Abu Dhabi real estate… e.g. &quot;3BR prices in Noya vs Yas Island last year&quot;"
        rows={2}
        disabled={isLoading}
        className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 pr-14 text-sm text-slate-100 placeholder-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 transition-colors"
      />
      <button
        type="submit"
        disabled={!value.trim() || isLoading}
        className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-opacity disabled:opacity-30 hover:opacity-90"
        aria-label="Submit"
      >
        {isLoading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        )}
      </button>
    </form>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/components/ChatInput.jsx
git commit -m "feat: add ChatInput component"
```

---

## Task 11: Create `SmartTopics.jsx`

Eight pre-built one-click topic chips shown above the chat input.

**Files:**
- Create: `src/components/SmartTopics.jsx`

**Step 1: Create `src/components/SmartTopics.jsx`**

```jsx
const TOPICS = [
  '3BR prices: Al Reem Island vs Yas Island vs Saadiyat',
  'Transaction volume by district in 2024',
  'How have off-plan apartment prices trended since 2022?',
  'Studio price per sqm across Abu Dhabi since 2020',
  'Most sold projects by volume in 2024',
  'Noya Phase 1 price trend over the last 2 years',
  '1BR vs 2BR vs 3BR prices on Yas Island',
  'Ready vs off-plan price gap since 2021',
]

export function SmartTopics({ onSelect, isLoading }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TOPICS.map(topic => (
        <button
          key={topic}
          onClick={() => onSelect(topic)}
          disabled={isLoading}
          className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-accent hover:text-white disabled:opacity-40"
        >
          {topic}
        </button>
      ))}
    </div>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/components/SmartTopics.jsx
git commit -m "feat: add SmartTopics component with 8 pre-built prompts"
```

---

## Task 12: Create `PostCard.jsx`

The central component: displays one analysis post with title, streaming text, chart, share button, and loading skeleton.

**Files:**
- Create: `src/components/PostCard.jsx`

**Step 1: Create `src/components/PostCard.jsx`**

```jsx
import { useState } from 'react'
import { DynamicChart } from './charts/DynamicChart'
import { buildShareUrl } from '../utils/deeplink'

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded bg-slate-700/50 ${className}`} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-56 w-full mt-4" />
    </div>
  )
}

export function PostCard({ post, onRemove }) {
  const [copied, setCopied] = useState(false)

  const isLoading = !post.analysisText && post.isStreaming !== false

  async function handleShare() {
    const url = buildShareUrl(post)
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const timeAgo = (() => {
    const diff = Date.now() - post.createdAt
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return new Date(post.createdAt).toLocaleDateString()
  })()

  return (
    <article className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 mb-1">{timeAgo}</p>
          <h2 className="text-base font-semibold text-white leading-snug">
            {post.title || post.prompt}
          </h2>
          {post.title && post.title !== post.prompt && (
            <p className="mt-0.5 text-xs text-slate-500 italic truncate">"{post.prompt}"</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleShare}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-white transition-colors"
            title="Copy shareable link"
          >
            {copied ? (
              <svg className="h-4 w-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
            )}
          </button>
          {onRemove && (
            <button
              onClick={() => onRemove(post.id)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-700 hover:text-slate-300 transition-colors"
              title="Remove post"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Analyst text */}
          {post.analysisText ? (
            <div className="text-sm text-slate-300 leading-relaxed space-y-3 whitespace-pre-wrap">
              {post.analysisText}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No analysis available.</p>
          )}

          {/* Chart */}
          {post.chartData?.length > 0 ? (
            <div className="mt-2">
              <DynamicChart
                intent={post.intent}
                chartData={post.chartData}
                chartKeys={post.chartKeys}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-600 text-center py-4">No chart data returned.</p>
          )}
        </>
      )}

      {/* Streaming indicator */}
      {post.isStreaming && post.analysisText && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex gap-0.5">
            <span className="animate-bounce [animation-delay:0ms]">·</span>
            <span className="animate-bounce [animation-delay:150ms]">·</span>
            <span className="animate-bounce [animation-delay:300ms]">·</span>
          </span>
          analysing…
        </div>
      )}
    </article>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/components/PostCard.jsx
git commit -m "feat: add PostCard component with streaming text, chart, share button, skeleton"
```

---

## Task 13: Create `PostFeed.jsx`

Renders the ordered list of post cards.

**Files:**
- Create: `src/components/PostFeed.jsx`

**Step 1: Create `src/components/PostFeed.jsx`**

```jsx
import { PostCard } from './PostCard'

export function PostFeed({ posts, pendingPost, onRemove }) {
  const allPosts = pendingPost ? [pendingPost, ...posts] : posts

  if (!allPosts.length) {
    return (
      <div className="py-16 text-center space-y-2">
        <p className="text-slate-500 text-sm">No analyses yet.</p>
        <p className="text-slate-600 text-xs">Pick a topic above or type your own question.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {allPosts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          onRemove={post.isStreaming ? undefined : onRemove}
        />
      ))}
    </div>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/components/PostFeed.jsx
git commit -m "feat: add PostFeed component"
```

---

## Task 14: Rewrite `App.jsx`

Replace the entire dashboard shell with the chat-based layout. Also handles deeplink routing.

**Files:**
- Modify: `src/App.jsx`

**Step 1: Rewrite `src/App.jsx` completely**

```jsx
import { useEffect } from 'react'
import { useDuckDB }    from './hooks/useDuckDB'
import { useAppData }   from './hooks/useAppData'
import { useAnalysis }  from './hooks/useAnalysis'
import { usePostStore } from './hooks/usePostStore'
import { ChatInput }    from './components/ChatInput'
import { SmartTopics }  from './components/SmartTopics'
import { PostFeed }     from './components/PostFeed'
import { PostCard }     from './components/PostCard'
import { parseShareUrl } from './utils/deeplink'

export default function App() {
  const { ready, error: dbError } = useDuckDB()
  const { meta }                  = useAppData(ready)
  const { posts, addPost, removePost, getPost } = usePostStore()
  const { analyze, status, error: analysisError, pendingPost } = useAnalysis(meta)

  const isLoading = ['analyzing', 'querying', 'explaining'].includes(status)

  // Handle deeplink: if URL has ?post=... show that single post
  const { postId, post: urlPost } = parseShareUrl()
  const deeplinkPost = postId ? (getPost(postId) ?? urlPost) : null

  // If we landed on a deeplink and the post isn't in localStorage yet, save it
  useEffect(() => {
    if (urlPost && !getPost(urlPost.id)) {
      addPost(urlPost)
    }
  }, []) // run once on mount

  // Deeplink view: show single post
  if (deeplinkPost) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100">
        <header className="border-b border-slate-800 px-6 py-4">
          <div className="mx-auto max-w-2xl flex items-center justify-between">
            <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Back to explorer
            </a>
            <span className="text-xs text-slate-600">Abu Dhabi Sales Explorer</span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-6 py-8">
          <PostCard post={deeplinkPost} />
        </main>
      </div>
    )
  }

  // Main view
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 sticky top-0 z-10 backdrop-blur bg-[#0f172a]/90">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Abu Dhabi Sales Explorer</h1>
            <p className="text-xs text-slate-500 mt-0.5">104,848 transactions · 2019–2026</p>
          </div>
          {dbError && (
            <span className="text-xs text-red-400">DB error: {dbError}</span>
          )}
          {!ready && !dbError && (
            <span className="text-xs text-slate-500 animate-pulse">Loading data…</span>
          )}
        </div>
      </header>

      {/* Chat area */}
      <main className="mx-auto max-w-2xl px-6 py-6 space-y-6">
        {/* Input section */}
        <section className="space-y-3">
          <SmartTopics onSelect={analyze} isLoading={isLoading || !ready} />
          <ChatInput onSubmit={analyze} isLoading={isLoading || !ready} />
          {analysisError && (
            <p className="text-xs text-red-400 px-1">{analysisError}</p>
          )}
        </section>

        {/* Post feed */}
        <PostFeed
          posts={posts}
          pendingPost={pendingPost}
          onRemove={removePost}
        />
      </main>
    </div>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add src/App.jsx
git commit -m "feat: rewrite App.jsx with chat-based layout and deeplink routing"
```

---

## Task 15: Delete old files

Remove files that were part of the old dashboard UX. Run a final test pass first to confirm nothing else imports them.

**Step 1: Check for any remaining imports of old files**

```bash
cd /Users/nagi/abudhabi-sales-explorer
grep -r "Sidebar\|FilterPill\|DateRangePicker\|ProjectSearch\|useFilters\|useChartData" src/ --include="*.jsx" --include="*.js" -l
```

Expected: empty output (no files importing these). If any file appears, update it before deleting.

**Step 2: Delete old files**

```bash
cd /Users/nagi/abudhabi-sales-explorer
rm src/components/Sidebar.jsx
rm src/components/FilterPill.jsx
rm src/components/DateRangePicker.jsx
rm src/components/ProjectSearch.jsx
rm src/hooks/useFilters.js
rm src/hooks/useChartData.js
```

**Step 3: Commit**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add -A
git commit -m "chore: delete old dashboard components and filter hooks"
```

---

## Task 16: Run build + all tests

Verify the app builds cleanly and all tests pass before declaring the feature complete.

**Step 1: Run tests**

```bash
cd /Users/nagi/abudhabi-sales-explorer && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: All tests PASS. If any fail, fix them before proceeding.

**Step 2: Run production build**

```bash
cd /Users/nagi/abudhabi-sales-explorer && npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors. There may be chunk size warnings about `@duckdb/duckdb-wasm` — these are acceptable.

**Step 3: Commit if there were any fix-up changes**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git add -A
git commit -m "fix: resolve any build/test issues after chat UX implementation"
```

---

## Task 17: Set up for Vercel deployment with API key

**Step 1: Verify the `vercel.json` already has COOP/COEP headers**

The existing `vercel.json` should already apply `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers to all routes. Verify:

```bash
cat /Users/nagi/abudhabi-sales-explorer/vercel.json
```

**Step 2: Push to GitHub**

```bash
cd /Users/nagi/abudhabi-sales-explorer
git push origin main
```

**Step 3: Add API key in Vercel Dashboard**

1. Go to `vercel.com/dashboard` → your project → **Settings** → **Environment Variables**
2. Add: `ANTHROPIC_API_KEY` = your key from `console.anthropic.com`
3. Set scope to **Production + Preview + Development**
4. Click **Save**
5. Trigger a new deployment: Vercel Dashboard → **Deployments** → **Redeploy**

**Step 4: Test a local dev session with the API (optional but recommended)**

```bash
npm install -g vercel   # one-time global install
cd /Users/nagi/abudhabi-sales-explorer
vercel dev              # starts on http://localhost:3000 with Edge Functions working
```

**Final verification:** Open the deployed URL, type a question, confirm the text streams in and a chart appears, copy the share link and open it in an incognito window.

---

## Summary of all new/changed files

| Action | File |
|--------|------|
| NEW | `api/analyze.js` |
| NEW | `api/explain.js` |
| NEW | `src/utils/intentToQuery.js` |
| NEW | `src/utils/intentToQuery.test.js` |
| NEW | `src/utils/deeplink.js` |
| NEW | `src/utils/deeplink.test.js` |
| NEW | `src/hooks/usePostStore.js` |
| NEW | `src/hooks/usePostStore.test.js` |
| NEW | `src/hooks/useAnalysis.js` |
| NEW | `src/components/ChatInput.jsx` |
| NEW | `src/components/SmartTopics.jsx` |
| NEW | `src/components/PostCard.jsx` |
| NEW | `src/components/PostFeed.jsx` |
| NEW | `src/components/charts/DynamicChart.jsx` |
| MODIFIED | `src/App.jsx` (full rewrite) |
| MODIFIED | `src/utils/queries.js` (2 new builders) |
| MODIFIED | `src/utils/queries.test.js` (new tests) |
| MODIFIED | `src/components/charts/ProjectComparisonChart.jsx` (rename prop) |
| DELETED | `src/components/Sidebar.jsx` |
| DELETED | `src/components/FilterPill.jsx` |
| DELETED | `src/components/DateRangePicker.jsx` |
| DELETED | `src/components/ProjectSearch.jsx` |
| DELETED | `src/hooks/useFilters.js` |
| DELETED | `src/hooks/useChartData.js` |
