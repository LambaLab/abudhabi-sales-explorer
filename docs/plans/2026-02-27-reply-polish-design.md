# Reply Polish + Query Block Design

**Date:** 2026-02-27
**Goal:** Make the query/question text clearly visible in both main cards and reply cards, improve reply card readability, and fix the reply analysis data-context bug.

---

## Problem Summary

1. **Query invisible:** In PostCard, the original question is tiny, italic, grey, and truncated. In ReplyCard it's `text-xs` with a `↳` arrow — easy to miss. Users can't see what was asked.
2. **ReplyCard too small:** Everything is `text-xs`, which is harder to read than the main card's `text-sm`/`text-base` prose.
3. **Reply analysis data bug:** When Claude marks a follow-up `chartNeeded: false` (e.g. "what did you mean by X?"), `summaryStats` stays empty `{}`. The explain prompt then has no KEY DATA, so the grounding clause forces the model to say "I don't have data." The parent's `summaryStats` is already stored on the post object — we just need to pass it as the fallback.

---

## Design

### Task 1 — Unified query block (PostCard + ReplyCard)

Replace the italic-truncated prompt line in PostCard and the `↳ text-xs` line in ReplyCard with a single styled block-quote pattern.

**PostCard** (replaces lines 143-145 in PostCard.jsx):
```jsx
{post.title && post.title !== post.prompt && (
  <div className="mt-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border-l-2 border-accent px-3 py-2">
    <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">"{post.prompt}"</p>
  </div>
)}
```

**ReplyCard** (replaces the `<p className="text-xs ...">↳ ...</p>` line):
```jsx
<div className="rounded-md bg-slate-50 dark:bg-slate-800/40 border-l-2 border-accent/60 px-2.5 py-1.5">
  <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">"{reply.prompt}"</p>
</div>
```

Both use `text-sm`, no truncation, subtle background, accent left-border. The reply variant uses `border-accent/60` (softer) and slightly less padding to remain visually subordinate.

---

### Task 2 — ReplyCard body upgrade

Change `ReplyCard.jsx` outer wrapper and body text:

| Property | Before | After |
|---|---|---|
| Outer padding | `ml-2 pl-3` | `ml-2 pl-4` |
| Outer spacing | `space-y-2` | `space-y-3` |
| Body font size | `text-xs` | `text-sm` |
| Body color | `text-slate-700 dark:text-slate-300` | `text-slate-800 dark:text-slate-200` |

No other changes — the left-border, dark mode, chart rendering, loading states all stay the same.

---

### Task 3 — Reply analysis data fallback

In `src/hooks/useAnalysis.js`, the `analyzeReply` function currently initialises `summaryStats = {}` and only overwrites it if a new DuckDB query runs and returns rows.

Fix: seed `summaryStats` from the parent post's stored `summaryStats` so conversational replies can reason about the parent's data:

```js
// Before
let summaryStats = {}

if (intent.chartNeeded !== false) {
  const { sql, params } = intentToQuery(intent)
  if (sql) {
    const rawRows = await query(sql, params)
    ...
    summaryStats = computeSummaryStats(rawRows, intent)
  }
}
```

```js
// After
let summaryStats = parent?.summaryStats ?? {}   // ← seed from parent

if (intent.chartNeeded !== false) {
  const { sql, params } = intentToQuery(intent)
  if (sql) {
    const rawRows = await query(sql, params)
    ...
    if (rawRows.length > 0) {
      summaryStats = computeSummaryStats(rawRows, intent)  // override only if new data exists
    }
    // else keep parent summaryStats as fallback
  }
}
```

`parent.summaryStats` is already persisted on the post object (confirmed: `usePostStore` v3 schema includes `summaryStats`). No store changes needed.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/PostCard.jsx` | Replace italic prompt line with block-quote div |
| `src/components/ReplyCard.jsx` | Replace `↳` prompt line + bump body to `text-sm` |
| `src/hooks/useAnalysis.js` | Seed `summaryStats` from parent post in `analyzeReply` |

## Non-Changes (YAGNI)

- ReplyCard does not get a share button, deeper analysis link, or chart type toggle
- The block-quote component is not extracted into a separate file (used in only 2 places)
- No new hooks, no new state
