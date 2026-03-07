# v1.18 UX Polish — Design Document

**Date:** 2026-03-07
**Status:** Approved

## Summary

Five targeted fixes addressing bugs and UX regressions found after v1.17 shipped:

1. **Suggestion reliability** — suggestions that also return no data
2. **Suggestion UI** — redesign to match Claude Code's clean grouped-row style
3. **Raw JSON in AIBubble** — short-mode response leaking JSON into chat bubbles
4. **Truncated sentences** — model cuts off mid-sentence in short mode
5. **User bubble alignment** — user messages should be right-aligned (regression)

---

## Issue 1 — Suggestion Reliability (Server-side Validation)

### Root Cause
`SHORT_NODATA_PROMPT` asks Claude to generate alternative queries, but Claude has no knowledge of what's in the DuckDB dataset. Generated suggestions can themselves return no data.

### Fix
After Claude returns the 2 suggestions, the server validates each one:
1. Call `fetchIntent(s.query)` on each suggestion
2. Run `intentToQuery(intent)` → `query(sql, params)` on each
3. Only return suggestions where `rawRows.length > 0`
4. If both fail: fall back to a hardcoded safe pool
5. If only 1 validates: return 1 suggestion

**Safe fallback pool** (always returns data):
```js
const SAFE_SUGGESTIONS = [
  { label: 'Transaction volume 2024', query: 'transaction volume by month 2024', reason: 'Monthly volume data exists for all of 2024' },
  { label: 'Price trend by district', query: 'average price per sqm by district', reason: 'Price-per-sqm records exist across all major districts' },
]
```

### `reason` field change
`reason` is now **user-facing** (shown as subtitle in the UI). Update `SHORT_NODATA_PROMPT` to instruct Claude to write `reason` as a brief, friendly explanation: "why this query will show you useful data" (max 10 words, plain English, no technical language).

---

## Issue 2 — Suggestion UI (Claude Code grouped-row style)

### Design

Replace individual bordered buttons with a **single grouped container** using `divide-y` between rows. No icons.

```
┌─────────────────────────────────────────────────┐
│  Off-plan volume by district                  1  │
│  Off-plan records cover all districts            │
├─────────────────────────────────────────────────┤
│  Ready price trend 2021–2025                  2  │
│  Single sale type records cover full period      │
├─────────────────────────────────────────────────┤
│  Type something else…                            │
└─────────────────────────────────────────────────┘
```

**Container:** `rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden`

**Each suggestion row (button):**
```jsx
<button className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left
  bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700/50
  transition-colors">
  <div className="flex flex-col gap-0.5 min-w-0">
    <span className="text-sm text-slate-800 dark:text-slate-100">{s.label}</span>
    <span className="text-xs text-slate-400 dark:text-slate-500 leading-snug">{s.reason}</span>
  </div>
  <span className="shrink-0 text-xs text-slate-400 font-mono">{i + 1}</span>
</button>
```

**"Type something else…" row (last):**
- When collapsed: a row with italic `text-slate-400 text-sm` that says "Type something else…"
- When clicked: the row expands into a textarea inline (ReplyInput behavior), replacing the row text

**No search icon** anywhere.

**Applied to:** PostCard and AIBubble (same component/pattern).

---

## Issue 3 + 4 — SHORT_PROMPT Raw JSON + Truncated Sentences

### Root Cause
`SHORT_PROMPT` instructs "1 sentence, flowing prose only" but the model sometimes returns `` ```json {"one_liner": "..."} `` anyway, or gets cut off mid-sentence due to token budget pressure.

### Fix A — Strengthen SHORT_PROMPT
Add to `SHORT_PROMPT`:
```
CRITICAL: Return ONLY a single complete sentence of plain English text.
Never return JSON, markdown, code fences, or any structured data.
The sentence must end with a period. One sentence only.
```

### Fix B — Client-side JSON extraction (`useAnalysis.js`)
New shared helper `extractShortText(raw)`:
```js
function extractShortText(raw) {
  if (!raw) return raw
  const { parsed } = parseAnalysis(raw)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    // Model returned JSON despite instructions — extract first readable string field
    return parsed.one_liner ?? parsed.headline ?? parsed.answer ?? parsed.analysis ?? raw
  }
  // Strip any leftover markdown fences
  return raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}
```

Applied in **both** `analyze()` and `analyzeReply()` when storing `analysisText` for non-noData responses.

---

## Issue 5 — User Bubble Right-Alignment

### Root Cause
`UserBubble.jsx` uses `flex flex-row` (left-to-right), placing the avatar on the left and the purple bubble to its right — but the whole row is left-anchored. User messages should appear on the **right** side of the chat, like iMessage "sent" bubbles.

### Fix — `UserBubble.jsx`

```jsx
// Before:
<div className="flex flex-row gap-3 items-start">
  {/* avatar left, bubble right */}
  <div ...avatar.../>
  <div className="flex flex-col gap-1 min-w-0">
    <p>name · time</p>
    <div className="rounded-xl bg-accent text-white ...">prompt</div>
  </div>
</div>

// After:
<div className="flex flex-row-reverse gap-3 items-start">
  {/* avatar right, bubble left-of-avatar but right-anchored overall */}
  <div ...avatar.../>
  <div className="flex flex-col gap-1 min-w-0 items-end">
    <p className="flex flex-row-reverse gap-1">name · time</p>
    <div className="rounded-xl bg-accent text-white ...">prompt</div>
  </div>
</div>
```

The PostCard header (title + prompt quote, not a bubble) is **not changed** — it's a card header, not a chat bubble.

---

## Files Changed

| File | Change |
|---|---|
| `api/explain.js` | Validate suggestions server-side; update `reason` prompt wording; strengthen `SHORT_PROMPT` |
| `src/hooks/useAnalysis.js` | Add `extractShortText()` helper; apply to `analyze()` and `analyzeReply()` |
| `src/components/PostCard.jsx` | Replace suggestion rows with grouped-container design |
| `src/components/AIBubble.jsx` | Same grouped-container design for reply suggestions |
| `src/components/UserBubble.jsx` | `flex-row-reverse` + `items-end` for right-alignment |
| Tests | Update/add tests for each changed component |

---

## Non-goals

- No "Skip" button (not needed — "Type something else…" covers free text)
- No numbered badge changes to the clarify chips (those are different component/UX)
- No changes to the PostCard header layout
- No changes to full-mode analysis rendering
