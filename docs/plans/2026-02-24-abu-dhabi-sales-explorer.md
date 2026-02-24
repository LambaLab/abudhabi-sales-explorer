# Abu Dhabi Sales Explorer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public Vite + React web app that lets users filter and visualise 104K Abu Dhabi real estate transactions via interactive charts, deployed to Vercel with CSV-swap updates.

**Architecture:** Single-page React app with DuckDB-WASM running SQL queries directly in the browser on a CSV file served from `/public/data/`. All filtering, aggregation, and charting happens client-side — no backend required. Updating data = replace CSV + git push.

**Tech Stack:** Vite, React 18, DuckDB-WASM (CDN bundles), Recharts, Tailwind CSS, Vitest (tests), Vercel (hosting)

---

## Task 1: Scaffold Vite + React project

**Files:**
- Create: `/Users/nagi/abudhabi-sales-explorer/` (already exists with git)

**Step 1: Create the Vite project inside the existing folder**

Run this in Terminal (open Terminal app, paste exactly):
```bash
cd /Users/nagi/abudhabi-sales-explorer
npm create vite@latest . -- --template react
```
When prompted "Current directory is not empty. Remove existing files and continue?" → press `y` then Enter.
When prompted for package name → press Enter to accept default.

Expected output: `Done. Now run: npm install`

**Step 2: Install base dependencies**

```bash
npm install
npm install @duckdb/duckdb-wasm recharts tailwindcss @tailwindcss/vite react-select date-fns
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

Expected: No errors. `node_modules/` folder appears.

**Step 3: Init Tailwind**

```bash
npx tailwindcss init
```

Expected: `tailwind.config.js` created.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React project with dependencies"
```

---

## Task 2: Configure Vite, Tailwind, and copy CSV

**Files:**
- Modify: `vite.config.js`
- Modify: `tailwind.config.js`
- Modify: `src/index.css`
- Create: `vercel.json`
- Create: `public/data/abu_dhabi_sales.csv` (copy from Downloads)

**Step 1: Replace `vite.config.js` entirely**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
  },
})
```

**Step 2: Replace `tailwind.config.js` entirely**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#1a1a2e',
        accent: '#e94560',
      },
    },
  },
  plugins: [],
}
```

**Step 3: Replace `src/index.css` entirely**

```css
@import "tailwindcss";

body {
  background-color: #0f0f23;
  color: #e2e8f0;
  font-family: 'Inter', system-ui, sans-serif;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #1a1a2e;
}
::-webkit-scrollbar-thumb {
  background: #374151;
  border-radius: 3px;
}
```

**Step 4: Create `vercel.json`**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

**Step 5: Create `src/test-setup.js`**

```js
import '@testing-library/jest-dom'
```

**Step 6: Add test script to `package.json`**

Find the `"scripts"` section in `package.json` and add `"test": "vitest"`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest"
},
```

**Step 7: Copy CSV file**

Run in Terminal:
```bash
mkdir -p /Users/nagi/abudhabi-sales-explorer/public/data
cp "/Users/nagi/Downloads/Abu Dhabi recent_sales.csv" /Users/nagi/abudhabi-sales-explorer/public/data/abu_dhabi_sales.csv
```

Expected: File appears at `public/data/abu_dhabi_sales.csv`

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: configure Vite, Tailwind, Vercel headers, and add CSV data"
```

---

## Task 3: DuckDB hook — load and query the CSV

**Files:**
- Create: `src/hooks/useDuckDB.js`
- Create: `src/utils/db.js`

**Step 1: Create `src/utils/db.js`** — singleton DB initialiser

```js
import * as duckdb from '@duckdb/duckdb-wasm'

let dbInstance = null
let connInstance = null

export async function getDB() {
  if (dbInstance) return { db: dbInstance, conn: connInstance }

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
  )
  const worker = new Worker(worker_url)
  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  URL.revokeObjectURL(worker_url)

  const conn = await db.connect()

  // Register the CSV file from public folder
  await db.registerFileURL(
    'sales.csv',
    '/data/abu_dhabi_sales.csv',
    duckdb.DuckDBDataProtocol.HTTP,
    false
  )

  // Create a clean view with renamed columns and proper types
  await conn.query(`
    CREATE VIEW IF NOT EXISTS sales AS
    SELECT
      "Asset Class"                                        AS asset_class,
      "Property Type"                                      AS property_type,
      TRY_CAST("Sale Application Date" AS DATE)            AS sale_date,
      TRY_CAST("Property Sold Area (SQM)" AS DOUBLE)       AS area_sqm,
      "Property Layout"                                    AS layout,
      "District"                                           AS district,
      "Community"                                          AS community,
      "Project Name"                                       AS project_name,
      TRY_CAST("Property Sale Price (AED)" AS DOUBLE)      AS price_aed,
      TRY_CAST("Property Sold Share" AS DOUBLE)            AS sold_share,
      TRY_CAST("Rate (AED per SQM)" AS DOUBLE)             AS rate_per_sqm,
      "Sale Application Type"                              AS sale_type,
      "Sale Sequence"                                      AS sale_sequence
    FROM read_csv_auto('sales.csv', HEADER=TRUE, IGNORE_ERRORS=TRUE)
  `)

  dbInstance = db
  connInstance = conn
  return { db, conn }
}

export async function query(sql, params = []) {
  const { conn } = await getDB()
  const stmt = await conn.prepare(sql)
  const result = await stmt.query(...params)
  await stmt.close()
  return result.toArray().map(row => row.toJSON())
}
```

**Step 2: Create `src/hooks/useDuckDB.js`**

```js
import { useState, useEffect } from 'react'
import { getDB } from '../utils/db'

export function useDuckDB() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getDB()
      .then(() => setReady(true))
      .catch(err => setError(err.message))
  }, [])

  return { ready, error }
}
```

**Step 3: Verify dev server starts**

```bash
cd /Users/nagi/abudhabi-sales-explorer
npm run dev
```

Expected: "Local: http://localhost:5173/" — open in browser, no red errors in terminal.
Press Ctrl+C to stop.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add DuckDB-WASM singleton and useDuckDB hook"
```

---

## Task 4: SQL query builders + tests

**Files:**
- Create: `src/utils/queries.js`
- Create: `src/utils/queries.test.js`

**Step 1: Write the failing tests first — `src/utils/queries.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { buildWhereClause, buildMonthlyPriceQuery, buildVolumeQuery } from './queries'

describe('buildWhereClause', () => {
  it('returns empty string when no filters', () => {
    const { where, params } = buildWhereClause({})
    expect(where).toBe('')
    expect(params).toEqual([])
  })

  it('adds date range filter', () => {
    const { where, params } = buildWhereClause({
      dateFrom: '2022-01-01',
      dateTo: '2023-12-31',
    })
    expect(where).toContain('sale_date >= ?')
    expect(where).toContain('sale_date <= ?')
    expect(params).toContain('2022-01-01')
    expect(params).toContain('2023-12-31')
  })

  it('adds district filter', () => {
    const { where, params } = buildWhereClause({ districts: ['Al Reem Island', 'Yas Island'] })
    expect(where).toContain('district IN')
    expect(params).toContain('Al Reem Island')
    expect(params).toContain('Yas Island')
  })

  it('adds property type filter', () => {
    const { where, params } = buildWhereClause({ propertyTypes: ['apartment'] })
    expect(where).toContain('property_type IN')
    expect(params).toContain('apartment')
  })

  it('adds price range filter', () => {
    const { where, params } = buildWhereClause({ priceMin: 500000, priceMax: 5000000 })
    expect(where).toContain('price_aed >= ?')
    expect(where).toContain('price_aed <= ?')
    expect(params).toContain(500000)
    expect(params).toContain(5000000)
  })
})

describe('buildMonthlyPriceQuery', () => {
  it('returns a SQL string', () => {
    const { sql } = buildMonthlyPriceQuery({})
    expect(typeof sql).toBe('string')
    expect(sql).toContain('SELECT')
    expect(sql).toContain('FROM sales')
  })

  it('includes WHERE clause when filters provided', () => {
    const { sql } = buildMonthlyPriceQuery({ dateFrom: '2022-01-01', dateTo: '2023-12-31' })
    expect(sql).toContain('WHERE')
  })
})

describe('buildVolumeQuery', () => {
  it('returns a SQL string with COUNT', () => {
    const { sql } = buildVolumeQuery({})
    expect(sql).toContain('COUNT(*)')
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: Multiple FAIL lines — "Cannot find module './queries'"

**Step 3: Write `src/utils/queries.js`**

```js
/**
 * Build a parameterised WHERE clause from filter state.
 * Returns { where: string, params: any[] }
 * where = '' if no filters, otherwise 'WHERE ...'
 */
export function buildWhereClause(filters = {}) {
  const conditions = []
  const params = []

  const { dateFrom, dateTo, districts, propertyTypes, layouts, saleTypes, saleSequences, priceMin, priceMax } = filters

  if (dateFrom) { conditions.push('sale_date >= ?'); params.push(dateFrom) }
  if (dateTo)   { conditions.push('sale_date <= ?'); params.push(dateTo) }

  if (districts?.length) {
    conditions.push(`district IN (${districts.map(() => '?').join(',')})`)
    params.push(...districts)
  }

  if (propertyTypes?.length) {
    conditions.push(`property_type IN (${propertyTypes.map(() => '?').join(',')})`)
    params.push(...propertyTypes)
  }

  if (layouts?.length && !layouts.includes('all')) {
    conditions.push(`layout IN (${layouts.map(() => '?').join(',')})`)
    params.push(...layouts)
  }

  if (saleTypes?.length && !saleTypes.includes('all')) {
    conditions.push(`sale_type IN (${saleTypes.map(() => '?').join(',')})`)
    params.push(...saleTypes)
  }

  if (saleSequences?.length && !saleSequences.includes('all')) {
    conditions.push(`sale_sequence IN (${saleSequences.map(() => '?').join(',')})`)
    params.push(...saleSequences)
  }

  if (priceMin != null) { conditions.push('price_aed >= ?'); params.push(priceMin) }
  if (priceMax != null) { conditions.push('price_aed <= ?'); params.push(priceMax) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return { where, params }
}

/**
 * Monthly median price query
 */
export function buildMonthlyPriceQuery(filters = {}) {
  const { where, params } = buildWhereClause(filters)
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')            AS month,
      MEDIAN(price_aed)                        AS median_price,
      COUNT(*)                                 AS tx_count
    FROM sales
    ${where}
      AND price_aed > 0
    GROUP BY month
    ORDER BY month
  `.replace('AND price_aed > 0', where ? 'AND price_aed > 0' : 'WHERE price_aed > 0')
  return { sql, params }
}

/**
 * Monthly median price-per-sqm query
 */
export function buildPricePerSqmQuery(filters = {}) {
  const { where, params } = buildWhereClause(filters)
  const base = where || 'WHERE'
  const connector = where ? 'AND' : ''
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')            AS month,
      MEDIAN(rate_per_sqm)                     AS median_rate,
      COUNT(*)                                 AS tx_count
    FROM sales
    ${base} ${connector} rate_per_sqm > 0
    GROUP BY month
    ORDER BY month
  `
  return { sql, params }
}

/**
 * Monthly transaction volume query
 */
export function buildVolumeQuery(filters = {}) {
  const { where, params } = buildWhereClause(filters)
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')            AS month,
      COUNT(*)                                 AS tx_count
    FROM sales
    ${where}
    GROUP BY month
    ORDER BY month
  `
  return { sql, params }
}

/**
 * Per-project monthly median price query (for comparison chart)
 * projectNames: string[]
 * dateFrom/dateTo only — ignores other filters intentionally
 */
export function buildProjectComparisonQuery({ projectNames = [], dateFrom, dateTo }) {
  if (!projectNames.length) return { sql: '', params: [] }
  const conditions = []
  const params = []
  if (dateFrom) { conditions.push('sale_date >= ?'); params.push(dateFrom) }
  if (dateTo)   { conditions.push('sale_date <= ?'); params.push(dateTo) }
  conditions.push(`project_name IN (${projectNames.map(() => '?').join(',')})`)
  params.push(...projectNames)
  conditions.push('price_aed > 0')
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')   AS month,
      project_name,
      MEDIAN(price_aed)               AS median_price,
      COUNT(*)                        AS tx_count
    FROM sales
    WHERE ${conditions.join(' AND ')}
    GROUP BY month, project_name
    ORDER BY month
  `
  return { sql, params }
}

/**
 * Get all distinct values for filter dropdowns
 */
export const META_QUERY = `
  SELECT
    (SELECT LIST(DISTINCT district ORDER BY district)      FROM sales WHERE district IS NOT NULL)       AS districts,
    (SELECT LIST(DISTINCT property_type ORDER BY property_type) FROM sales WHERE property_type IS NOT NULL) AS property_types,
    (SELECT LIST(DISTINCT layout ORDER BY layout)          FROM sales WHERE layout IS NOT NULL AND layout != 'unclassified') AS layouts,
    (SELECT LIST(DISTINCT project_name ORDER BY project_name) FROM sales WHERE project_name IS NOT NULL) AS projects,
    MIN(sale_date)  AS min_date,
    MAX(sale_date)  AS max_date,
    MIN(price_aed)  AS min_price,
    MAX(price_aed)  AS max_price
  FROM sales
  WHERE price_aed > 0
`
```

**Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: All green ✓

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add SQL query builders with passing tests"
```

---

## Task 5: App shell, loading screen, and metadata hook

**Files:**
- Modify: `src/main.jsx`
- Replace: `src/App.jsx`
- Create: `src/hooks/useAppData.js`
- Delete: `src/App.css` (not needed)

**Step 1: Replace `src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**Step 2: Create `src/hooks/useAppData.js`** — loads filter metadata from DuckDB

```js
import { useState, useEffect } from 'react'
import { query } from '../utils/db'
import { META_QUERY } from '../utils/queries'

export function useAppData(ready) {
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ready) return
    query(META_QUERY)
      .then(rows => {
        const row = rows[0]
        setMeta({
          districts: row.districts ?? [],
          propertyTypes: row.property_types ?? [],
          layouts: row.layouts ?? [],
          projects: row.projects ?? [],
          minDate: row.min_date,
          maxDate: row.max_date,
          minPrice: row.min_price,
          maxPrice: row.max_price,
        })
      })
      .catch(err => setError(err.message))
  }, [ready])

  return { meta, error }
}
```

**Step 3: Replace `src/App.jsx`**

```jsx
import { useState } from 'react'
import { useDuckDB } from './hooks/useDuckDB'
import { useAppData } from './hooks/useAppData'

export default function App() {
  const { ready, error: dbError } = useDuckDB()
  const { meta, error: metaError } = useAppData(ready)
  const error = dbError || metaError

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-400 text-center">
          <p className="text-xl font-bold mb-2">Failed to load data</p>
          <p className="text-sm opacity-70">{error}</p>
        </div>
      </div>
    )
  }

  if (!ready || !meta) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading {(104848).toLocaleString()}+ records…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-brand border-b border-slate-700 shrink-0">
        <h1 className="text-white font-semibold text-lg tracking-tight">
          Abu Dhabi Sales Explorer
        </h1>
        <span className="text-slate-400 text-xs">{(104848).toLocaleString()} transactions · 2019–2026</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar placeholder */}
        <aside className="w-64 shrink-0 bg-brand border-r border-slate-700 overflow-y-auto p-4">
          <p className="text-slate-500 text-xs">Filters coming in next task</p>
        </aside>

        {/* Main content placeholder */}
        <main className="flex-1 overflow-y-auto p-6">
          <p className="text-slate-500 text-xs">Charts coming soon — meta loaded ✓</p>
          <pre className="text-xs text-slate-600 mt-4">{JSON.stringify(meta, null, 2).slice(0, 300)}…</pre>
        </main>
      </div>
    </div>
  )
}
```

**Step 4: Verify in browser**

```bash
npm run dev
```

Open http://localhost:5173 — should see spinner → then "Filters coming in next task" once loaded (~5–15s first time).

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: app shell with loading state and metadata hook"
```

---

## Task 6: Filter state and Sidebar component

**Files:**
- Create: `src/hooks/useFilters.js`
- Create: `src/components/Sidebar.jsx`
- Create: `src/components/FilterPill.jsx`

**Step 1: Create `src/hooks/useFilters.js`**

```js
import { useState, useCallback } from 'react'

export function useFilters(meta) {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    districts: [],
    propertyTypes: [],
    layouts: [],
    saleTypes: [],       // [] = all
    saleSequences: [],   // [] = all
    priceMin: null,
    priceMax: null,
  })

  const update = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(() => {
    setFilters({
      dateFrom: '', dateTo: '',
      districts: [], propertyTypes: [], layouts: [],
      saleTypes: [], saleSequences: [],
      priceMin: null, priceMax: null,
    })
  }, [])

  return { filters, update, reset }
}
```

**Step 2: Create `src/components/FilterPill.jsx`** — toggle pill (All / Off-plan / Ready)

```jsx
export function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-accent border-accent text-white'
          : 'border-slate-600 text-slate-400 hover:border-slate-400'
      }`}
    >
      {label}
    </button>
  )
}
```

**Step 3: Create `src/components/Sidebar.jsx`**

```jsx
import Select from 'react-select'
import { FilterPill } from './FilterPill'

const selectStyles = {
  control: (b) => ({ ...b, backgroundColor: '#1a1a2e', borderColor: '#374151', minHeight: 32 }),
  menu: (b) => ({ ...b, backgroundColor: '#1a1a2e', zIndex: 50 }),
  option: (b, s) => ({ ...b, backgroundColor: s.isFocused ? '#374151' : '#1a1a2e', color: '#e2e8f0' }),
  multiValue: (b) => ({ ...b, backgroundColor: '#374151' }),
  multiValueLabel: (b) => ({ ...b, color: '#e2e8f0' }),
  multiValueRemove: (b) => ({ ...b, color: '#9ca3af', ':hover': { backgroundColor: '#e94560', color: '#fff' } }),
  input: (b) => ({ ...b, color: '#e2e8f0' }),
  placeholder: (b) => ({ ...b, color: '#6b7280' }),
  singleValue: (b) => ({ ...b, color: '#e2e8f0' }),
}

const toOptions = (arr) => arr.map(v => ({ value: v, label: v }))

export function Sidebar({ meta, filters, update, reset }) {
  const saleTypeOptions = ['all', 'off-plan', 'ready', 'court-mandated']
  const marketOptions = ['all', 'primary', 'secondary']

  return (
    <aside className="w-64 shrink-0 bg-brand border-r border-slate-700 overflow-y-auto flex flex-col">
      <div className="p-4 space-y-5">
        {/* Reset */}
        <button
          onClick={reset}
          className="w-full text-xs text-slate-400 hover:text-white border border-slate-700 rounded py-1.5 transition-colors"
        >
          Reset all filters
        </button>

        {/* District */}
        <FilterSection label="District">
          <Select
            isMulti
            options={toOptions(meta.districts)}
            styles={selectStyles}
            placeholder="All districts…"
            value={filters.districts.map(v => ({ value: v, label: v }))}
            onChange={opts => update('districts', opts.map(o => o.value))}
          />
        </FilterSection>

        {/* Property Type */}
        <FilterSection label="Property Type">
          <Select
            isMulti
            options={toOptions(meta.propertyTypes)}
            styles={selectStyles}
            placeholder="All types…"
            value={filters.propertyTypes.map(v => ({ value: v, label: v }))}
            onChange={opts => update('propertyTypes', opts.map(o => o.value))}
          />
        </FilterSection>

        {/* Layout */}
        <FilterSection label="Layout">
          <Select
            isMulti
            options={toOptions(meta.layouts)}
            styles={selectStyles}
            placeholder="All layouts…"
            value={filters.layouts.map(v => ({ value: v, label: v }))}
            onChange={opts => update('layouts', opts.map(o => o.value))}
          />
        </FilterSection>

        {/* Sale Type */}
        <FilterSection label="Sale Type">
          <div className="flex flex-wrap gap-1.5">
            {saleTypeOptions.map(opt => (
              <FilterPill
                key={opt}
                label={opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                active={
                  opt === 'all'
                    ? filters.saleTypes.length === 0
                    : filters.saleTypes.includes(opt)
                }
                onClick={() => {
                  if (opt === 'all') update('saleTypes', [])
                  else {
                    const next = filters.saleTypes.includes(opt)
                      ? filters.saleTypes.filter(v => v !== opt)
                      : [...filters.saleTypes, opt]
                    update('saleTypes', next)
                  }
                }}
              />
            ))}
          </div>
        </FilterSection>

        {/* Market */}
        <FilterSection label="Market">
          <div className="flex flex-wrap gap-1.5">
            {marketOptions.map(opt => (
              <FilterPill
                key={opt}
                label={opt.charAt(0).toUpperCase() + opt.slice(1)}
                active={
                  opt === 'all'
                    ? filters.saleSequences.length === 0
                    : filters.saleSequences.includes(opt)
                }
                onClick={() => {
                  if (opt === 'all') update('saleSequences', [])
                  else {
                    const next = filters.saleSequences.includes(opt)
                      ? filters.saleSequences.filter(v => v !== opt)
                      : [...filters.saleSequences, opt]
                    update('saleSequences', next)
                  }
                }}
              />
            ))}
          </div>
        </FilterSection>

        {/* Price Range */}
        <FilterSection label="Price Range (AED)">
          <div className="space-y-2">
            <input
              type="number"
              placeholder="Min price"
              value={filters.priceMin ?? ''}
              onChange={e => update('priceMin', e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600"
            />
            <input
              type="number"
              placeholder="Max price"
              value={filters.priceMax ?? ''}
              onChange={e => update('priceMax', e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600"
            />
          </div>
        </FilterSection>
      </div>
    </aside>
  )
}

function FilterSection({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  )
}
```

**Step 4: Wire Sidebar into App.jsx** — replace the `<aside>` placeholder:

Find this in `App.jsx`:
```jsx
import { useState } from 'react'
import { useDuckDB } from './hooks/useDuckDB'
import { useAppData } from './hooks/useAppData'
```

Replace with:
```jsx
import { useState } from 'react'
import { useDuckDB } from './hooks/useDuckDB'
import { useAppData } from './hooks/useAppData'
import { useFilters } from './hooks/useFilters'
import { Sidebar } from './components/Sidebar'
```

Then find `export default function App()` and add after the meta/error/ready declarations:
```jsx
const { filters, update, reset } = useFilters(meta)
```

Replace the `<aside>` placeholder block:
```jsx
<Sidebar meta={meta} filters={filters} update={update} reset={reset} />
```

**Step 5: Verify filters render**

```bash
npm run dev
```

Open http://localhost:5173 — sidebar should show all filter controls with dropdowns.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: sidebar filters with district, type, layout, sale type, market, price"
```

---

## Task 7: Date range picker in header

**Files:**
- Create: `src/components/DateRangePicker.jsx`
- Modify: `src/App.jsx`

**Step 1: Create `src/components/DateRangePicker.jsx`**

```jsx
export function DateRangePicker({ meta, filters, update }) {
  if (!meta) return null
  const minStr = meta.minDate?.toISOString?.()?.slice(0, 10) ?? '2019-01-01'
  const maxStr = meta.maxDate?.toISOString?.()?.slice(0, 10) ?? '2026-12-31'

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500">From</span>
      <input
        type="date"
        min={minStr}
        max={filters.dateTo || maxStr}
        value={filters.dateFrom || minStr}
        onChange={e => update('dateFrom', e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs"
      />
      <span className="text-slate-500">to</span>
      <input
        type="date"
        min={filters.dateFrom || minStr}
        max={maxStr}
        value={filters.dateTo || maxStr}
        onChange={e => update('dateTo', e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs"
      />
    </div>
  )
}
```

**Step 2: Add DateRangePicker to App.jsx header**

Add import at the top of `App.jsx`:
```jsx
import { DateRangePicker } from './components/DateRangePicker'
```

Replace the header content:
```jsx
<header className="flex items-center justify-between px-6 py-3 bg-brand border-b border-slate-700 shrink-0">
  <h1 className="text-white font-semibold text-lg tracking-tight">
    Abu Dhabi Sales Explorer
  </h1>
  <DateRangePicker meta={meta} filters={filters} update={update} />
</header>
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: date range picker in header bar"
```

---

## Task 8: Chart data hook

**Files:**
- Create: `src/hooks/useChartData.js`

**Step 1: Create `src/hooks/useChartData.js`**

```js
import { useState, useEffect, useRef } from 'react'
import { query } from '../utils/db'
import {
  buildMonthlyPriceQuery,
  buildPricePerSqmQuery,
  buildVolumeQuery,
  buildProjectComparisonQuery,
} from '../utils/queries'

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export function useChartData(filters, selectedProjects, ready) {
  const [priceData, setPriceData] = useState([])
  const [sqmData, setSqmData] = useState([])
  const [volumeData, setVolumeData] = useState([])
  const [comparisonData, setComparisonData] = useState({})
  const [loading, setLoading] = useState(false)

  const debouncedFilters = useDebounce(filters, 400)
  const debouncedProjects = useDebounce(selectedProjects, 400)

  useEffect(() => {
    if (!ready) return

    let cancelled = false
    setLoading(true)

    const { sql: pSql, params: pParams } = buildMonthlyPriceQuery(debouncedFilters)
    const { sql: sSql, params: sParams } = buildPricePerSqmQuery(debouncedFilters)
    const { sql: vSql, params: vParams } = buildVolumeQuery(debouncedFilters)

    Promise.all([
      query(pSql, pParams),
      query(sSql, sParams),
      query(vSql, vParams),
    ]).then(([price, sqm, volume]) => {
      if (cancelled) return
      setPriceData(price)
      setSqmData(sqm)
      setVolumeData(volume)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [debouncedFilters, ready])

  useEffect(() => {
    if (!ready || !debouncedProjects.length) {
      setComparisonData({})
      return
    }

    const { sql, params } = buildProjectComparisonQuery({
      projectNames: debouncedProjects,
      dateFrom: debouncedFilters.dateFrom,
      dateTo: debouncedFilters.dateTo,
    })

    if (!sql) return

    query(sql, params).then(rows => {
      // Group rows by month, pivot projects as keys
      const byMonth = {}
      rows.forEach(row => {
        if (!byMonth[row.month]) byMonth[row.month] = { month: row.month }
        byMonth[row.month][row.project_name] = Math.round(row.median_price)
      })
      setComparisonData(Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)))
    })
  }, [debouncedProjects, debouncedFilters.dateFrom, debouncedFilters.dateTo, ready])

  return { priceData, sqmData, volumeData, comparisonData, loading }
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: useChartData hook with debounced queries for all 4 charts"
```

---

## Task 9: Median Price and Price/SQM charts

**Files:**
- Create: `src/components/charts/ChartCard.jsx`
- Create: `src/components/charts/MedianPriceChart.jsx`
- Create: `src/components/charts/PricePerSqmChart.jsx`

**Step 1: Create `src/components/charts/ChartCard.jsx`** — shared wrapper

```jsx
export function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {empty ? (
        <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
          No data for current filters
        </div>
      ) : (
        children
      )}
    </div>
  )
}
```

**Step 2: Create `src/components/charts/MedianPriceChart.jsx`**

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'

const fmt = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-medium">AED {Number(payload[0]?.value).toLocaleString()}</p>
      <p className="text-slate-500">{payload[0]?.payload?.tx_count?.toLocaleString()} transactions</p>
    </div>
  )
}

export function MedianPriceChart({ data }) {
  return (
    <ChartCard
      title="Median Sale Price"
      subtitle="Monthly median · AED"
      empty={!data?.length}
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="median_price" stroke="#e94560" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#e94560' }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

**Step 3: Create `src/components/charts/PricePerSqmChart.jsx`**

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'

const fmt = (v) => `${(v / 1_000).toFixed(0)}K`

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-medium">AED {Number(payload[0]?.value).toLocaleString()} / sqm</p>
      <p className="text-slate-500">{payload[0]?.payload?.tx_count?.toLocaleString()} transactions</p>
    </div>
  )
}

export function PricePerSqmChart({ data }) {
  return (
    <ChartCard
      title="Price per SQM"
      subtitle="Monthly median · AED/sqm"
      empty={!data?.length}
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="median_rate" stroke="#38bdf8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#38bdf8' }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: median price and price-per-sqm line charts"
```

---

## Task 10: Volume chart

**Files:**
- Create: `src/components/charts/VolumeChart.jsx`

**Step 1: Create `src/components/charts/VolumeChart.jsx`**

```jsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-medium">{Number(payload[0]?.value).toLocaleString()} transactions</p>
    </div>
  )
}

export function VolumeChart({ data }) {
  return (
    <ChartCard
      title="Transaction Volume"
      subtitle="Number of sales per month"
      empty={!data?.length}
    >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="tx_count" fill="#6366f1" radius={[2, 2, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: transaction volume bar chart"
```

---

## Task 11: Project search and comparison chart

**Files:**
- Create: `src/components/ProjectSearch.jsx`
- Create: `src/components/charts/ProjectComparisonChart.jsx`

**Step 1: Create `src/components/ProjectSearch.jsx`**

```jsx
import Select from 'react-select'

const selectStyles = {
  control: (b) => ({ ...b, backgroundColor: '#0f172a', borderColor: '#374151', minHeight: 32 }),
  menu: (b) => ({ ...b, backgroundColor: '#1e293b', zIndex: 50 }),
  option: (b, s) => ({ ...b, backgroundColor: s.isFocused ? '#374151' : '#1e293b', color: '#e2e8f0', fontSize: 12 }),
  multiValue: (b) => ({ ...b, backgroundColor: '#374151' }),
  multiValueLabel: (b) => ({ ...b, color: '#e2e8f0', fontSize: 11 }),
  multiValueRemove: (b) => ({ ...b, color: '#9ca3af', ':hover': { backgroundColor: '#e94560', color: '#fff' } }),
  input: (b) => ({ ...b, color: '#e2e8f0', fontSize: 12 }),
  placeholder: (b) => ({ ...b, color: '#6b7280', fontSize: 12 }),
}

const COLORS = ['#e94560', '#38bdf8', '#a3e635', '#fb923c', '#c084fc', '#34d399', '#f472b6', '#fbbf24']

export function ProjectSearch({ projects, selected, onChange }) {
  const options = projects.map(p => ({ value: p, label: p }))
  const value = selected.map(p => ({ value: p, label: p }))

  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
        Compare Projects
      </p>
      <Select
        isMulti
        options={options}
        value={value}
        onChange={opts => onChange(opts.map(o => o.value).slice(0, 8))}
        styles={selectStyles}
        placeholder="Search and select projects…"
        noOptionsMessage={() => 'No projects found'}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((p, i) => (
            <span key={p} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] + '22', color: COLORS[i % COLORS.length], border: `1px solid ${COLORS[i % COLORS.length]}44` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export { COLORS }
```

**Step 2: Create `src/components/charts/ProjectComparisonChart.jsx`**

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartCard } from './ChartCard'
import { COLORS } from '../ProjectSearch'

const fmt = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`

export function ProjectComparisonChart({ data, projects }) {
  const isEmpty = !data || !Array.isArray(data) || data.length === 0 || !projects.length

  return (
    <ChartCard
      title="Project Comparison"
      subtitle={projects.length ? `Median price · ${projects.length} project${projects.length > 1 ? 's' : ''}` : 'Select projects above to compare'}
      empty={isEmpty}
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(value, name) => [`AED ${Number(value).toLocaleString()}`, name]}
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
          {projects.map((project, i) => (
            <Line
              key={project}
              type="monotone"
              dataKey={project}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: project search multi-select and comparison chart"
```

---

## Task 12: Wire everything together in App.jsx

**Files:**
- Replace: `src/App.jsx` (final version)

**Step 1: Replace `src/App.jsx` with final wired-up version**

```jsx
import { useState } from 'react'
import { useDuckDB } from './hooks/useDuckDB'
import { useAppData } from './hooks/useAppData'
import { useFilters } from './hooks/useFilters'
import { useChartData } from './hooks/useChartData'
import { Sidebar } from './components/Sidebar'
import { DateRangePicker } from './components/DateRangePicker'
import { ProjectSearch } from './components/ProjectSearch'
import { MedianPriceChart } from './components/charts/MedianPriceChart'
import { PricePerSqmChart } from './components/charts/PricePerSqmChart'
import { VolumeChart } from './components/charts/VolumeChart'
import { ProjectComparisonChart } from './components/charts/ProjectComparisonChart'

export default function App() {
  const { ready, error: dbError } = useDuckDB()
  const { meta, error: metaError } = useAppData(ready)
  const { filters, update, reset } = useFilters(meta)
  const [selectedProjects, setSelectedProjects] = useState([])
  const { priceData, sqmData, volumeData, comparisonData, loading } = useChartData(filters, selectedProjects, ready)

  const error = dbError || metaError

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-400 text-center">
          <p className="text-xl font-bold mb-2">Failed to load data</p>
          <p className="text-sm opacity-70">{error}</p>
        </div>
      </div>
    )
  }

  if (!ready || !meta) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading {(104848).toLocaleString()}+ records…</p>
        <p className="text-slate-600 text-xs">This takes ~10s on first visit, then it's instant</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-brand border-b border-slate-700 shrink-0 gap-4">
        <h1 className="text-white font-semibold text-lg tracking-tight shrink-0">
          Abu Dhabi Sales Explorer
        </h1>
        <DateRangePicker meta={meta} filters={filters} update={update} />
        {loading && (
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 bg-brand border-r border-slate-700 overflow-y-auto">
          <Sidebar meta={meta} filters={filters} update={update} reset={reset} />
          <div className="px-4 pb-4">
            <ProjectSearch
              projects={meta.projects}
              selected={selectedProjects}
              onChange={setSelectedProjects}
            />
          </div>
        </aside>

        {/* Charts */}
        <main className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Top row: price + sqm side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <MedianPriceChart data={priceData} />
            <PricePerSqmChart data={sqmData} />
          </div>

          {/* Comparison chart — full width */}
          <ProjectComparisonChart data={comparisonData} projects={selectedProjects} />

          {/* Volume — full width */}
          <VolumeChart data={volumeData} />
        </main>
      </div>
    </div>
  )
}
```

**Step 2: Verify everything in browser**

```bash
npm run dev
```

Check:
- Loading spinner appears on start
- Charts render with real data
- Changing a filter updates all charts
- Selecting projects shows comparison lines
- Date range changes affect all charts

**Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass ✓

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire all charts and filters into final App.jsx"
```

---

## Task 13: GitHub repository setup (non-developer guide)

**Step 1: Create a GitHub account** (if you don't have one)

Go to https://github.com → "Sign up" → create a free account.

**Step 2: Create a new repository**

- On GitHub, click the **+** button (top right) → "New repository"
- Name it: `abudhabi-sales-explorer`
- Set to **Public** (so Vercel can access it for free)
- Do **NOT** tick "Add README" — leave everything unchecked
- Click "Create repository"

**Step 3: Connect your local project to GitHub**

GitHub will show you commands — use the "push an existing repository" section. Run these in Terminal:

```bash
cd /Users/nagi/abudhabi-sales-explorer
git remote add origin https://github.com/YOUR_USERNAME/abudhabi-sales-explorer.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

When prompted for credentials, use your GitHub username and a **Personal Access Token** (not your password):
- Go to https://github.com/settings/tokens → "Generate new token (classic)"
- Give it a name, tick `repo`, click "Generate"
- Copy the token and paste it as the password

**Step 4: Verify**

Refresh your GitHub repository page — you should see all the project files.

---

## Task 14: Deploy to Vercel (non-developer guide)

**Step 1: Create Vercel account**

Go to https://vercel.com → "Sign Up" → choose "Continue with GitHub" → authorize Vercel.

**Step 2: Import your project**

- On Vercel dashboard, click "Add New…" → "Project"
- You'll see your GitHub repos — click "Import" next to `abudhabi-sales-explorer`

**Step 3: Configure build settings**

Vercel will auto-detect Vite. Confirm these settings:
- **Framework Preset:** Vite
- **Build Command:** `vite build` (auto-filled)
- **Output Directory:** `dist` (auto-filled)

Click **Deploy**.

**Step 4: Wait ~2 minutes**

Vercel builds and deploys. When done, it shows a URL like:
`https://abudhabi-sales-explorer.vercel.app`

**This is your public link — share it with anyone.**

**Step 5: Updating the data in future**

When you have a new CSV file:
1. Replace `public/data/abu_dhabi_sales.csv` with the new file (same name)
2. Run in Terminal:
   ```bash
   cd /Users/nagi/abudhabi-sales-explorer
   git add public/data/abu_dhabi_sales.csv
   git commit -m "data: update sales CSV"
   git push
   ```
3. Vercel auto-redeploys in ~1 minute → everyone sees the new data.

---

## Summary of all files created

```
src/
  App.jsx                               ← main wired-up app
  main.jsx
  index.css
  hooks/
    useDuckDB.js                        ← DuckDB initialisation
    useAppData.js                       ← filter metadata query
    useFilters.js                       ← filter state management
    useChartData.js                     ← all chart queries (debounced)
  utils/
    db.js                               ← DuckDB singleton + query helper
    queries.js                          ← SQL query builders
    queries.test.js                     ← tests for query builders
  components/
    Sidebar.jsx
    FilterPill.jsx
    DateRangePicker.jsx
    ProjectSearch.jsx
    charts/
      ChartCard.jsx
      MedianPriceChart.jsx
      PricePerSqmChart.jsx
      VolumeChart.jsx
      ProjectComparisonChart.jsx
public/
  data/
    abu_dhabi_sales.csv                 ← the data (replace to update)
vercel.json                             ← COOP/COEP headers for DuckDB-WASM
```
