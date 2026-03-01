# Design: UX Polish 7 — 5 Bug Fixes

**Date:** 2026-03-01
**Status:** Approved

---

## Issues Being Fixed

1. **Frosted bottom bar not transparent** — Bottom bar is a flex sibling below `<main>`; nothing scrolls behind it.
2. **Date picker clipped by overflow container** — `absolute bottom-full` inside `overflow-y-auto` gets clipped.
3. **From/To fields empty for "All time"** — No defaults when `value.dateFrom`/`value.dateTo` are empty.
4. **Chart Type sub-menu missing** — Bar/Line buttons inline in PlusMenu main view; user wants sub-panel navigation like Date Range.
5. **VolumeChart ignores chartType** — Always renders as BarChart regardless of the bar/line setting.

---

## Fix 1: Frosted Bottom Bar

**File:** `src/App.jsx`

Change the bottom bar div from a `shrink-0` flex sibling to an absolutely-positioned overlay:

```jsx
// Before:
<div className="shrink-0 px-4 py-3 z-10 bg-slate-50/75 dark:bg-[#0f172a]/75 backdrop-blur-md">

// After:
<div className="absolute bottom-0 left-0 right-0 px-4 py-3 z-10 bg-slate-50/75 dark:bg-[#0f172a]/75 backdrop-blur-md">
```

The `relative` wrapper and `pb-24` padding on the scroll content already accommodate this.

---

## Fix 2: Date Picker Portal — Fixed Positioning

**File:** `src/components/DateRangePickerPopover.jsx`

Replace `absolute bottom-full / top-full` positioning with a `createPortal` rendering at `document.body` using `position: fixed`. Smart flip: opens above trigger by default; flips below if fewer than 420px of space above.

### Position calculation (runs when `open` becomes true):

```js
function updatePos() {
  if (!btnRef.current) return
  const r   = btnRef.current.getBoundingClientRect()
  const spaceAbove = r.top
  const goDown = align === 'down' || spaceAbove < 420
  setPos({
    fixedTop:    goDown ? r.bottom + 8 : undefined,
    fixedBottom: goDown ? undefined : window.innerHeight - r.top + 8,
    fixedLeft:   Math.max(8, Math.min(r.left, window.innerWidth - 448)),
  })
}
useEffect(() => { if (open) updatePos() }, [open])
```

### Portal rendering:

```jsx
{open && pos && createPortal(
  <div
    ref={popRef}
    style={{
      position: 'fixed',
      top:    pos.fixedTop,
      bottom: pos.fixedBottom,
      left:   pos.fixedLeft,
      zIndex: 9999,
    }}
    className="flex flex-row w-[440px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden"
  >
    {/* ... same interior ... */}
  </div>,
  document.body
)}
```

Close on scroll: add a `scroll` listener on `window` that calls `setOpen(false)` when the picker is open.

---

## Fix 3: From/To Defaults for "All time"

**File:** `src/components/DateRangePickerPopover.jsx`

```js
const DEFAULT_FROM = '2020-01'
const DEFAULT_TO   = () => toYM(new Date())

// State initialization:
const [manualFrom, setManualFrom] = useState(value?.dateFrom || DEFAULT_FROM)
const [manualTo,   setManualTo]   = useState(value?.dateTo   || DEFAULT_TO())

// Calendar range initialization:
const [range, setRange] = useState({
  from: fromYM(value?.dateFrom || DEFAULT_FROM),
  to:   fromYM(value?.dateTo   || DEFAULT_TO()),
})

// useEffect sync:
setManualFrom(value?.dateFrom || DEFAULT_FROM)
setManualTo(value?.dateTo   || DEFAULT_TO())
setRange({
  from: fromYM(value?.dateFrom || DEFAULT_FROM),
  to:   fromYM(value?.dateTo   || DEFAULT_TO()),
})
```

---

## Fix 4: Chart Type Sub-menu in PlusMenu

**File:** `src/components/PlusMenu.jsx`

Add `view='chart'` to the state machine. Remove the inline bar/line toggle from the main view. Chart Type row becomes a navigable chevron link like Date Range.

### State machine:
`view = 'main' | 'dates' | 'chart'`

### Main view (Chart Type row):
```jsx
<button onClick={() => setView('chart')} className="...">
  <span className="... icon container">
    <svg>bar chart icon</svg>
  </span>
  <div className="flex-1 min-w-0">
    <p>Chart Type</p>
    <p className="text-xs text-slate-500 truncate capitalize">{settings.chartType}</p>
  </div>
  <svg>chevron right</svg>
</button>
```

### Chart sub-panel:
```
← Chart Type
────────────────────────────
  ✓ Bar   (checkmark if active)
    Line
```

Clicking a type calls `onSettingsChange({ chartType: type })` then `setOpen(false)` (closes the whole menu).

On close reset: `if (!open) { setView('main'); setCustomError('') }` — already handles this since view resets.

---

## Fix 5: VolumeChart — chartType support + accent color fix

**Files:** `src/components/charts/VolumeChart.jsx`, `src/components/charts/DynamicChart.jsx`

### VolumeChart.jsx:

```jsx
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export function VolumeChart({ data, chartType = 'bar' }) {
  const common = { data, margin: { top: 4, right: 8, left: 0, bottom: 0 } }
  const xAxis = <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
  const yAxis = <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={40} />
  const tooltip = <Tooltip content={<CustomTooltip />} />

  return (
    <ChartCard title="Transaction Volume" subtitle="Number of sales per month" empty={!data?.length}>
      <ResponsiveContainer width="100%" height={180}>
        {chartType === 'line' ? (
          <LineChart {...common}>
            {xAxis}{yAxis}{tooltip}
            <Line type="monotone" dataKey="tx_count" stroke="#9266cc" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#9266cc' }} />
          </LineChart>
        ) : (
          <BarChart {...common}>
            {xAxis}{yAxis}{tooltip}
            <Bar dataKey="tx_count" fill="#9266cc" radius={[2, 2, 0, 0]} maxBarSize={16} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

### DynamicChart.jsx:

```jsx
if (queryType === 'volume_trend') {
  return <VolumeChart data={chartData} chartType={chartType} />
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/App.jsx` | Bottom bar: `shrink-0` → `absolute bottom-0 left-0 right-0` |
| `src/components/DateRangePickerPopover.jsx` | Portal + fixed positioning; From/To defaults |
| `src/components/PlusMenu.jsx` | Add `view='chart'` sub-panel; remove inline toggle |
| `src/components/charts/VolumeChart.jsx` | Add `chartType` prop; fix color to `#9266cc` |
| `src/components/charts/DynamicChart.jsx` | Pass `chartType` to VolumeChart |

## Success Criteria

1. Page content scrolls visibly behind the frosted ChatInput bar
2. Date picker always appears fully within viewport (never clipped) — opens below trigger if less than 420px above
3. Picker closes when user scrolls the underlying page
4. From/To inputs always show dates (defaults: 2020-01 to current month) even for "All time"
5. PlusMenu Chart Type navigates to a sub-panel; selecting bar/line closes the whole menu
6. VolumeChart respects the chartType setting (bar or line)
7. VolumeChart accent color matches the rest (`#9266cc`)
8. 67/67 tests pass
