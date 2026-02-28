# UX Polish 4 — Inputs, Errors, Cursor, Date Picker Design

**Date:** 2026-02-28
**Status:** Approved

## Six Changes

### 1. Fully round pill inputs

**Scope:** `ChatInput.jsx` form, `ReplyInput` (inside `PostCard.jsx`) form.

Change `rounded-2xl` → `rounded-full` on both `<form>` elements. The pill expands vertically as the textarea grows; `rounded-full` maintains a fully circular cap at any height (same pattern as Gemini/Claude.ai).

---

### 2. Click-away to close ReplyInput

**Scope:** `ReplyInput` component inside `PostCard.jsx`.

Add a `wrapperRef = useRef(null)` around the expanded `<form>`. Register a `mousedown` listener (same pattern as `PlusMenu`) that calls `setOpen(false); setValue('')` when the click is outside `wrapperRef`. Clean up listener on `open` → false transition.

---

### 3. AI clarification instead of red error messages

**Scope:** `src/hooks/useAnalysis.js` catch block, `api/explain.js`.

**Current behaviour:** Errors (SQL failure, no results, unclear intent) patch `{ status: 'error', error: err.message }`, rendering red text.

**New behaviour:**
- In the `catch` block of both `analyze` and `analyzeReply` in `useAnalysis.js`, instead of patching `status: 'error'`, call `streamExplain(prompt, intent, {}, signal, 'clarify')` and patch `{ status: 'done', analysisText: clarifyText }`.
- If `intent` was never fetched (error happened at Step 2), pass `intent = null`.
- In `api/explain.js`, add a `'clarify'` mode branch. The system prompt instructs Claude to act as a helpful analyst who couldn't process the query, restate what it understood from the prompt in plain language, then ask one focused clarifying question. Tone: friendly, concise, never shows raw SQL or technical errors.
- Keep `AbortError` handling unchanged (still returns silently).

---

### 4. Global cursor: pointer

**Scope:** `src/index.css`.

Add after the `body` block:
```css
button, a, select, [role="button"] {
  cursor: pointer;
}
```

One rule, cascades to all interactive elements app-wide.

---

### 5. Elegant + menu (PlusMenu redesign)

**Scope:** `src/components/PlusMenu.jsx`.

**Trigger button:** Replace the text `+` in a `rounded-xl` with a `rounded-full h-8 w-8` circle icon button using a `+` SVG icon (not text), `bg-slate-100 dark:bg-slate-800` with `hover:bg-slate-200` ring.

**Popover card:** `rounded-2xl shadow-lg border` white/dark card, `w-72`, two rows:

```
┌─────────────────────────────────────────────┐
│ 📅  Date Range          Last 12 months  ›   │
├─────────────────────────────────────────────┤
│ 📊  Chart Type         [ Bar ]  Line        │
└─────────────────────────────────────────────┘
```

- Row 1 — **Date Range**: icon + label left, current preset value + chevron right. Clicking the row opens the `DateRangePickerPopover` inline (replaces the old radio buttons).
- Row 2 — **Chart Type**: icon + label left, `Bar | Line` segmented toggle right (same as existing but inline in row).
- Subtle `border-b` divider between rows. Rows have `hover:bg-slate-50 dark:hover:bg-slate-700/50` hover state.

---

### 6. Date range picker (react-day-picker)

**New dependency:** `react-day-picker` v9 (compatible with existing `date-fns` v4).

**New file:** `src/components/DateRangePickerPopover.jsx`

**API:**
```jsx
<DateRangePickerPopover
  value={{ dateFrom: 'YYYY-MM', dateTo: 'YYYY-MM' }}
  onChange={({ dateFrom, dateTo }) => ...}
  triggerClassName="..."   // optional override
/>
```

**Trigger:** A pill button showing selected range label (e.g. "Last 12 months" or "Jan 2024 – Feb 2026") with a calendar icon. Active state shows `border-accent text-accent`.

**Popover layout (desktop):**
```
┌──────────────────┬─────────────────────────────────┐
│ Presets          │  January 2026   February 2026   │
│                  │                                 │
│ Last 30 days     │  [calendar]     [calendar]      │
│ Last month       │                                 │
│ Last 90 days     │                                 │
│ Last quarter     │                                 │
│ Last 12 months ✓ │                                 │
│ Last year        │                                 │
│                  ├─────────────────────────────────│
│                  │          [Cancel]  [Apply]      │
└──────────────────┴─────────────────────────────────┘
```

**Popover layout (mobile, ≤640px):** presets stacked above single-month calendar. Apply/Cancel below.

**Presets:**

| Label | Calculation |
|---|---|
| Last 30 days | today − 30d to today |
| Last month | first day of prev month to last day of prev month |
| Last 90 days | today − 90d to today |
| Last quarter | first day of prev quarter to last day of prev quarter |
| Last 12 months | today − 12 months to today |
| Last year | Jan 1 to Dec 31 of previous year |

**Internal date format:** The component accepts and emits `{ dateFrom: 'YYYY-MM', dateTo: 'YYYY-MM' }` (month granularity). Internally uses `Date` objects for the calendar. On Apply, truncates selection to `YYYY-MM`.

**Styling:** Calendar days in selected range get `bg-accent/20`; start/end days get `bg-accent text-white rounded-full`. Preset list items use `text-sm py-1.5 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700`. Active preset gets `bg-accent/10 text-accent font-medium`.

**Where used:**
- Replace `InlineDateRange.jsx` usage in `PostCard.jsx` (per-chart override)
- Replace date preset `<select>` in `ChartFilterBar.jsx`
- Used inside `PlusMenu.jsx` Row 1 (default date range setting)

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Add global `cursor: pointer` rule |
| `src/components/ChatInput.jsx` | `rounded-2xl` → `rounded-full` |
| `src/components/PostCard.jsx` | ReplyInput: `rounded-2xl` → `rounded-full`, add click-away ref |
| `src/components/PlusMenu.jsx` | Full redesign as elegant list popover |
| `src/components/DateRangePickerPopover.jsx` | New component (react-day-picker) |
| `src/components/ChartFilterBar.jsx` | Replace date select with `DateRangePickerPopover` |
| `src/hooks/useAnalysis.js` | Error catch → clarify mode instead of error state |
| `api/explain.js` | Add `'clarify'` mode branch |
| `package.json` | Add `react-day-picker` v9 |

## Install

```bash
npm install react-day-picker@^9
```
