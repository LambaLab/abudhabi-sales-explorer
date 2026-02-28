# Design: PlusMenu Two-Step Panel + DateRangePickerPopover v9 Fix

**Date:** 2026-02-28
**Status:** Approved

---

## Problems Being Solved

### 1. Date Range in PlusMenu does nothing
Root cause: PlusMenu card has `overflow-hidden`. The nested `DateRangePickerPopover` opens an `absolute bottom-full` popover that is clipped by this overflow. Nothing appears.

### 2. DateRangePickerPopover calendar is broken in ChartFilterBar
Root cause: react-day-picker v9 changed its DOM structure. The `<nav>` element (prev/next arrows) is rendered **above** the `months` container as a DOM sibling — not inside `month_caption`. Our `month_caption: 'flex items-center justify-between'` classname had no nav child to spread against, causing the arrows to appear outside the calendar and the layout to break.

### 3. PlusMenu UX should match Claude Code nested-menu style
Current implementation nests a full popover inside a popover card, which is fragile architecture. Desired UX: main list with `›` arrows → sub-panel replaces/extends the card (Claude Code style).

---

## Approved Design

### Part 1: PlusMenu — Two-Step Panel (state machine)

**File:** `src/components/PlusMenu.jsx` — full rewrite

State: `view: 'main' | 'dates'`

**Main view:**
```
┌─────────────────────────────┐
│  📅  Date Range   Last 90d  › │
│  ────────────────────────── │
│  📊  Chart Type  [Bar][Line] │
└─────────────────────────────┘
```

**Date sub-panel** (view = 'dates'):
```
┌─────────────────────────────┐
│  ‹ Date Range                │
│  ────────────────────────── │
│    Last 30 days              │
│    Last month                │
│  ● Last 90 days  ← active   │
│    Last quarter              │
│    Last 12 months            │
│    Last year                 │
│  ────────────────────────── │
│  Custom:  [YYYY-MM] [YYYY-MM]│
│                     [Apply]  │
└─────────────────────────────┘
```

**Key decisions:**
- `DateRangePickerPopover` is NOT used inside PlusMenu — date logic is built inline
- No `overflow-hidden` on the card
- Presets are the same 6 as DateRangePickerPopover (imported from there via `PRESETS` or duplicated)
- Custom range: two `<input type="month">` fields + Apply button
- `‹ Back` returns to main view; preset click auto-closes the whole PlusMenu
- Chart Type toggle stays on main view only (no submenu needed)
- `settingsToRange()` helper preserved for converting legacy `'12m'`/`'24m'`/`'all'`/`'custom'` keys

**Props unchanged:** `{ settings, onSettingsChange }`

---

### Part 2: DateRangePickerPopover — Fix react-day-picker v9 classNames

**File:** `src/components/DateRangePickerPopover.jsx` — classNames section only

react-day-picker v9 DOM structure (with 1 or 2 months):
```
root (div)
  nav (div — sibling to months, rendered BEFORE months)
    button_previous
    button_next
  months (div)
    month (div)
      month_caption (div — label only, no nav child)
        caption_label (span)
      month_grid (table)
        weekdays / week / day / day_button
```

**Fix strategy:** Use `root: 'relative'` + position nav absolutely at top of root + pad months below.

```
classNames={{
  root:            'relative',
  nav:             'absolute top-0 inset-x-0 flex justify-between items-center px-1 h-8 z-10',
  button_previous: 'h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500',
  button_next:     'h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500',
  months:          'flex gap-6 pt-8',          ← pt-8 clears the absolute nav
  month:           'min-w-[220px]',
  month_caption:   'text-center mb-3',         ← centered label only, no justify-between
  caption_label:   'text-sm font-semibold text-slate-800 dark:text-slate-200',
  // ... rest unchanged
}}
```

Visual result:
```
‹                               ›   ← absolute nav at top
  February 2026  March 2026        ← centered caption labels
  Su Mo Tu We Th Fr Sa  ...        ← grids
```

No other changes to DateRangePickerPopover logic (presets, apply/cancel, outside-click, sync effect all unchanged).

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/PlusMenu.jsx` | Full rewrite: two-step panel, no nested popover |
| `src/components/DateRangePickerPopover.jsx` | Fix classNames for v9 nav layout |

## Not Changing

- `src/components/ChartFilterBar.jsx` — already correct, just needs the picker fix
- `src/components/PostCard.jsx` — already correct, just needs the picker fix
- All other files unchanged

---

## Success Criteria

1. Clicking `+` → Date Range row → date sub-panel appears with presets and custom inputs
2. Selecting a preset in PlusMenu applies the setting and closes the menu
3. Back button returns to main PlusMenu view
4. DateRangePickerPopover in ChartFilterBar shows correct calendar layout: nav arrows at top-left/right, month labels centered, full 7-column grid visible
5. DateRangePickerPopover in PostCard unchanged behavior, improved calendar layout
6. 67/67 tests still pass
