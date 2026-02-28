# Design: UX Polish 6 — Date Picker Layout, PlusMenu Icons, Transparency & Scroll Button

**Date:** 2026-02-28
**Status:** Approved

---

## Problems Being Solved

1. **DateRangePickerPopover presets above calendar** — Quick Select should be beside (sideways) the calendar, not stacked above it.
2. **No manual date entry in DateRangePickerPopover** — User wants two From/To month inputs alongside the calendar.
3. **PlusMenu uses emojis** — Should use elegant monochrome SVG icons like Claude Code.
4. **PlusMenu Custom Range allows invalid text** — `input[type=month]` in Firefox accepts freetext; no validation.
5. **ChatInput bottom row not transparent** — Content scrolling behind it should show through (frosted glass).
6. **No scroll-to-bottom button** — After scrolling up the feed, there is no way to jump back to the latest post.

---

## Approved Design

### Part 1: DateRangePickerPopover — Sideways layout + manual From/To inputs

**File:** `src/components/DateRangePickerPopover.jsx`

Change the popover from a vertical stack to a horizontal split:

```
┌─────────────────────────────────────────────────┐
│ Quick select   │  ‹  February 2026  ›            │
│  Last 30 days  │  Su Mo Tu We Th Fr Sa           │
│  Last month    │   1  2  3  4  5  6  7           │
│  Last 90 days  │   8  9 10 11 12 13 14           │
│  Last quarter  │  15 16 17 18 19 20 21           │
│  Last 12 mo.   │  22 23 24 25 26 27 28           │
│  Last year     ├───────────────────────────────  │
│                │  From [2025-01]  To [2026-02]   │
│                │            [Cancel] [Apply]      │
└─────────────────────────────────────────────────┘
```

**Layout changes:**
- Outer popover: `flex flex-row w-[440px]` (was `flex-col w-72`)
- Left column: `w-36 shrink-0 border-r border-slate-100 dark:border-slate-700 p-3 flex flex-col gap-0.5` — presets list
- Right column: `flex-1 p-3 flex flex-col` — calendar + manual inputs + buttons
- DayPicker: stays 1 month (`numMonths = 1`)

**Manual date inputs (new — replaces the simple Apply/Cancel row):**
```jsx
{/* From / To manual inputs */}
<div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
  <div className="flex-1">
    <p className="text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wide">From</p>
    <input type="month" value={manualFrom} onChange={...} ... />
  </div>
  <div className="flex-1">
    <p className="text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wide">To</p>
    <input type="month" value={manualTo} onChange={...} ... />
  </div>
</div>
{validationError && <p className="text-[10px] text-red-400 mt-1">{validationError}</p>}
<div className="flex justify-end gap-2 mt-2">
  <button onClick={handleCancel}>Cancel</button>
  <button onClick={applyManualOrRange}>Apply</button>
</div>
```

**Apply logic:** Apply uses `manualFrom`/`manualTo` if they are valid `YYYY-MM` values (validated against `/^\d{4}-(0[1-9]|1[0-2])$/`), otherwise falls back to `range.from`/`range.to`. Calendar clicks update both the visual range AND the manual inputs in sync.

**Popover open direction:**
- Default: `bottom-full mb-2` (opens upward — keeps PostCard working)
- For ChartFilterBar: `align="down"` prop value opens `top-full mt-1` (opens downward)
- Add `align` values: `'left'` | `'right'` | `'down'` — default stays `'left'` (upward)

---

### Part 2: PlusMenu — Monochrome SVG icons

**File:** `src/components/PlusMenu.jsx`

Replace emoji icon spans with SVG icons. Icon container: `bg-slate-100 dark:bg-slate-700/60` (neutral), icon color: `text-slate-500 dark:text-slate-400`.

**Date Range icon** (calendar):
```svg
<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
  <path d="M16 2v4M8 2v4M3 10h18"/>
</svg>
```

**Chart Type icon** (bar chart):
```svg
<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
</svg>
```

---

### Part 3: PlusMenu Custom Range — validation

**File:** `src/components/PlusMenu.jsx`

In `handleCustomApply`, add validation before calling `onSettingsChange`:

```js
function handleCustomApply() {
  const isValidYM = v => /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
  if (!isValidYM(customFrom) || !isValidYM(customTo)) {
    setCustomError('Please use YYYY-MM format (e.g. 2025-01)')
    return
  }
  if (customFrom > customTo) {
    setCustomError('"From" must be before "To"')
    return
  }
  setCustomError('')
  onSettingsChange({ defaultDateRange: 'custom', customFrom, customTo })
  setOpen(false)
}
```

Add `[customError, setCustomError] = useState('')` state. Show error below inputs. Also add `min`/`max` attributes to the month inputs and rely on browser's native picker for modern Chrome/Safari users.

---

### Part 4: ChatInput bottom row — transparent backdrop-blur

**File:** `src/App.jsx`

```jsx
// Before (line 163):
<div className="shrink-0 px-4 py-3 z-10">

// After:
<div className="shrink-0 px-4 py-3 z-10 bg-slate-50/75 dark:bg-[#0f172a]/75 backdrop-blur-md">
```

Also add `pb-24` to the inner scroll content div (line 150) so posts are not hidden behind the frosted bar:
```jsx
// Before:
<div className="mx-auto max-w-2xl px-4 py-4 space-y-4">

// After:
<div className="mx-auto max-w-2xl px-4 pt-4 pb-24 space-y-4">
```

---

### Part 5: Scroll-to-bottom button

**File:** `src/App.jsx`

Add inside the feed section (after `<main>` and before the bottom bar):

```jsx
// New state + ref
const mainRef = useRef(null)
const [showScrollDown, setShowScrollDown] = useState(false)

// Scroll listener effect
useEffect(() => {
  const el = mainRef.current
  if (!el) return
  function onScroll() {
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollDown(distFromBottom > 200)
  }
  el.addEventListener('scroll', onScroll, { passive: true })
  return () => el.removeEventListener('scroll', onScroll)
}, [])

// On main element
<main ref={mainRef} className="flex-1 overflow-y-auto">

// Scroll-to-bottom button (inside feed section, after main, before bottom bar)
{showScrollDown && (
  <div className="absolute bottom-20 inset-x-0 flex justify-center z-20 pointer-events-none">
    <button
      type="button"
      onClick={() => feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
      className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white text-xs font-medium shadow-lg hover:opacity-90 transition-opacity"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
      </svg>
      Jump to latest
    </button>
  </div>
)}
```

The parent feed `<>` wrapper needs `relative` class so the absolute button positions correctly.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/DateRangePickerPopover.jsx` | Sideways layout (flex-row w-[440px]), manual From/To inputs, align='down' support |
| `src/components/PlusMenu.jsx` | SVG icons instead of emojis, custom range validation, error state |
| `src/App.jsx` | Transparent bottom bar, scroll-to-bottom button |

## Not Changing
- `src/components/ChartFilterBar.jsx` — only needs `align="down"` added to DateRangePickerPopover call
- All other files

---

## Success Criteria

1. DateRangePickerPopover shows presets on the left, calendar on the right (side by side)
2. Two manual From/To month inputs appear below the calendar; entering valid YYYY-MM and clicking Apply works
3. Calendar clicks sync to manual inputs
4. PlusMenu shows monochrome SVG calendar and chart icons (no emojis)
5. PlusMenu custom range Apply validates input and shows error for invalid/mismatched dates
6. Content scrolls visibly behind the semi-transparent + blurred ChatInput bar
7. Scrolling up 200px+ reveals a "Jump to latest" button; clicking it smoothly scrolls to the newest post
8. 67/67 tests still pass
