# UI Polish 3 — Brand Purple, Input Pill Fixes

**Date:** 2026-02-27
**Status:** Approved

## Problem

Three visual issues remain after previous polish rounds:

1. **Brand color is red/pink (`#e94560`)** — should be the octopus logo's purple (`#9266cc`, sampled from public/octopus.png)
2. **ChatInput `+` button is bottom-aligned** — form uses `items-end` so PlusMenu floats to textarea bottom edge, not vertically centered in the pill
3. **ReplyInput is visually broken** — still the old bare `border-b border-slate-600 text-slate-200` underline design; never received the pill treatment

## Approved Design

### 1. Brand Color (index.css)

Change the single token:
```css
--color-accent: #9266cc;   /* was: #e94560 */
```

All downstream usages (`bg-accent`, `text-accent`, `border-accent`, `ring-accent`, `accent-accent`, chart bars) adopt the new purple automatically.

### 2. ChatInput `+` Alignment (ChatInput.jsx)

Change the form root class from `items-end` → `items-center`:
```jsx
<form className="relative flex items-center rounded-2xl border ...">
```

The `+` button (`h-9 w-9`) was rendering at the textarea's bottom edge. With `items-center` it stays vertically centered regardless of textarea height.

### 3. ReplyInput Pill (PostCard.jsx — ReplyInput component)

**Keep** the two-state pattern (collapsed "Ask a follow-up" button → expanded form).

**Replace** the expanded form's bare underline with a proper pill:

```jsx
<form
  onSubmit={handleSubmit}
  className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700
             bg-white dark:bg-slate-800/60 shadow-sm px-3 py-1
             focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-colors"
>
  <textarea
    className="flex-1 resize-none bg-transparent text-sm text-slate-900 dark:text-slate-100
               placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none py-2"
    ...
  />
  <button
    type="submit"
    className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl
               bg-accent text-white disabled:opacity-30 hover:opacity-80 transition-opacity"
  >
    <svg ...arrow icon... />
  </button>
</form>
```

Key changes:
- Remove `border-b border-slate-600 text-slate-200` (hardcoded dark underline)
- Remove `ml-2 pl-3 border-l-2 border-accent/40 items-end gap-2` wrapper
- Add `rounded-2xl border bg-white dark:bg-slate-800/60 focus-within:ring-accent` pill
- Replace `→` text button with proper icon button using `bg-accent`
- Change `items-end` → `items-center` for vertical centering

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | `--color-accent: #9266cc` |
| `src/components/ChatInput.jsx` | form: `items-end` → `items-center` |
| `src/components/PostCard.jsx` | `ReplyInput` expanded form: full pill redesign |

## Testing

- No new logic — all changes are CSS/layout only
- Run `npx vitest run` to confirm zero regressions
- Visual check: dev server screenshot before/after
