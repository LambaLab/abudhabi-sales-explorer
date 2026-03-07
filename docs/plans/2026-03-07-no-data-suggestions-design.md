# No-Data State: Hide Chips + Intelligent Fallback Suggestions

**Date:** 2026-03-07
**Status:** Approved
**Version:** v1.17

---

## Problem

When a query returns no matching rows from DuckDB, the app currently:
1. Shows chart chips (Multi-line, Bar, Line, etc.) that are meaningless with no data
2. Renders the structured "Insufficient data" AnalysisBlock — but nothing actionable for the user follows

Users are left with a dead end. They see a wall of explanation and no clear path forward.

---

## Goals

1. **Hide chart chips** when no data is available (they offer no value)
2. **Show 2 intelligent fallback suggestions** — specific alternative queries Claude knows would return real data
3. **Maximise value from every response** — no dead ends, always a next step
4. **Consistent UX** — same behaviour for top-level posts and thread replies

---

## Design Decisions (from requirements interview)

| Question | Decision |
|---|---|
| No-data signal | Server-side in `api/explain.js`: detects empty `summaryStats` in short mode |
| Fallback source | Embedded in the existing `streamExplain('short')` call — zero extra latency |
| Suggestion format | `{ label, query, reason }` — label shown, query runs on tap, reason hidden (internal) |
| Suggestion count | Exactly 2 |
| Chip visibility | Hidden entirely when `noData` (replaced by suggestion rows) |
| Suggestion UX | Replaces "Ask a follow-up" while visible; matches Claude Code clarify chip style |
| Free-text option | "Something else…" as the last suggestion row; expands to reply input inline |
| Tap action | Runs as inline thread reply (existing `analyzeReply` pipeline) |
| Nested no-data | Recursive — each no-data reply also shows fresh suggestions |
| Persistence | Hidden after first reply (same rule as `clarifyOptions`) |
| Reply scope | Both top-level posts AND thread replies (AIBubble updated) |
| "Deeper analysis" | Repurposed as "Explore alternatives" for noData posts; tapping runs `suggestions[0].query` as a reply |
| Suggestions extraction | `parseAnalysis(text)` shared utility — returns `{ parsed, suggestions }` |

---

## Architecture

### 1. Server: `api/explain.js` — `SHORT_NODATA_PROMPT`

**Trigger:** `mode === 'short'` AND `summaryStats` has no meaningful data
(detected by: no `series`, no `totalTransactions`, or all series have zero values)

**Behaviour:** Switches from `SHORT_PROMPT` (plain text, 80 tokens) to `SHORT_NODATA_PROMPT`
(haiku, ~300 tokens, non-streaming JSON response)

**Response schema:**
```json
{
  "headline": "No Ready vs Off-Plan comparison data since 2021",
  "analysis": "No matching transaction records found for this query combination.",
  "suggestions": [
    {
      "label": "Ready price trend 2021-2025",
      "query": "Ready property price trend since 2021",
      "reason": "Single sale type data exists even where dual-series comparison doesn't"
    },
    {
      "label": "Off-plan volume by district",
      "query": "Off-plan volume by district 2021-2025",
      "reason": "Volume series covers the full timeframe"
    }
  ]
}
```

**Key insight:** `streamExplain` on the client reads bytes until `done:true` — it works identically whether the server streams or writes all at once. Zero client-side architecture change.

**No-data detection helper:**
```js
function hasData(summaryStats) {
  if (!summaryStats) return false
  if (summaryStats.totalTransactions > 0) return true
  if (summaryStats.series?.some(s => s.txCount > 0 || s.first !== undefined)) return true
  return false
}
```

---

### 2. New Utility: `src/utils/parseAnalysis.js`

Single source of truth for JSON extraction from LLM text. Replaces the inline fence-stripping + `{…}` extraction that currently exists only in `AnalysisBlock.jsx`.

```js
/**
 * Robust extraction of the first {...} JSON object from LLM text.
 * Returns { parsed, suggestions } where:
 * - parsed: the full parsed object (or null if not valid JSON)
 * - suggestions: array from parsed.suggestions (or null)
 */
export function parseAnalysis(text) { ... }
```

Used by:
- `useAnalysis.js` — to detect `noData` and extract `suggestions` to store on post/reply
- `AnalysisBlock.jsx` — refactored to use this utility (no behavioral change, just DRY)

---

### 3. Post Schema Additions

Two new fields added via `patchPost` / `patchReply`:

| Field | Type | Description |
|---|---|---|
| `noData` | `boolean` | `true` when summaryStats was empty and suggestions were returned |
| `suggestions` | `Array<{label, query, reason}>` \| `null` | The 2 fallback alternatives from Claude |

No store schema changes required — `patchPost` is free-form.

---

### 4. Signal Propagation in `useAnalysis.js`

**In `analyze()`** — after `streamExplain('short')` completes:
```js
const { parsed, suggestions } = parseAnalysis(shortText)
const noData = !!(suggestions?.length > 0)
patchPost(postId, {
  status: 'done',
  analysisText: shortText,
  shortText,
  summaryStats,
  fullText: null,
  isExpanded: false,
  noData: noData || false,
  suggestions: suggestions ?? null,
})
```

**In `analyzeReply()`** — same pattern, applied to `patchReply`:
```js
const { parsed, suggestions } = parseAnalysis(replyText)
const noData = !!(suggestions?.length > 0)
patchReply(postId, replyId, {
  status: 'done',
  analysisText: noData ? (parsed?.headline ?? replyText) : replyText,
  noData: noData || false,
  suggestions: noData ? suggestions : null,
})
```

For replies, `analysisText` is set to `parsed.headline` (a short sentence) — fits the chat bubble naturally. Full structured rendering is not needed in the reply context.

---

### 5. UI Changes

#### `ChartSwitcher.jsx`
```js
// First line of the component:
if (post.noData) return null
```
One line. All chip rendering gone when no data.

---

#### `PostCard.jsx` — "Deeper analysis" button repurposed

```jsx
{(isDone || post.status === 'deepening') && (
  post.noData ? (
    // "Explore alternatives" — runs top suggestion as a thread reply
    post.suggestions?.length > 0 && onReply && (
      <button onClick={() => requireAuth(() => onReply(post.id, post.suggestions[0].query))}>
        <ExploreIcon /> Explore alternatives
      </button>
    )
  ) : (
    // Normal "Deeper analysis" — unchanged
    onDeepAnalysis && <button onClick={...}>...</button>
  )
)}
```

---

#### `PostCard.jsx` — Suggestion rows (replacing "Ask a follow-up")

**Visibility condition:** `isDone && post.noData && post.suggestions?.length > 0 && !post.replies?.length`

**Layout:**
```
┌────────────────────────────────────────────────┐
│  → Ready price trend 2021-2025                 │  ← suggestion row
│  → Off-plan volume by district                 │  ← suggestion row
│  ✏  Something else…                            │  ← expands to ReplyInput
└────────────────────────────────────────────────┘
```

Each suggestion row: full-width, left-aligned, arrow icon, styled as bordered row.
Tapping: `requireAuth(() => onReply(post.id, s.query))`

"Something else…" row: reuses `ReplyInput` component with a `label="Something else…"` prop (no new component).

**The existing "Ask a follow-up" is hidden while suggestions are visible** (`!(post.noData && !post.replies?.length)` guard).

---

#### `AIBubble.jsx` — Reply suggestions

Add support for `reply.suggestions` alongside existing `reply.clarifyOptions`:

```jsx
{/* No-data suggestions — shown below bubble like clarify chips */}
{reply.suggestions?.length > 0 && (
  <div className="flex flex-col gap-1.5 ml-8 mt-1">
    {reply.suggestions.map((s, i) => (
      <button key={i} onClick={() => onReply(postId, s.query)}>
        → {s.label}
      </button>
    ))}
  </div>
)}
```

Display uses `s.label` (concise), runs `s.query` on tap (complete query string). Separate from `clarifyOptions` — no collision.

---

## Data Flow Diagram

```
User query
    │
    ▼
fetchIntent (haiku)  →  post.intent (suggestedCharts, queryType, etc.)
    │
    ▼
DuckDB query  ──────────────────────────────────────────────────┐
    │                                                            │
    ▼ rows > 0                                      ▼ rows = 0  │
computeSummaryStats                         computeSummaryStats  │
(has data)                                  (empty)              │
    │                                                            │
    ▼                                                            ▼
streamExplain('short')                    streamExplain('short')
→ SHORT_PROMPT                            → SHORT_NODATA_PROMPT
→ plain text sentence                     → JSON {headline, analysis, suggestions[]}
    │                                                            │
    ▼                                                            ▼
parseAnalysis()                           parseAnalysis()
→ { parsed: null, suggestions: null }     → { parsed: {...}, suggestions: [...] }
    │                                                            │
    ▼                                                            ▼
patchPost({                               patchPost({
  analysisText: plainText,                  analysisText: jsonText,
  noData: false,                            noData: true,
  suggestions: null                         suggestions: [{label,query,reason}]
})                                        })
    │                                                            │
    ▼                                                            ▼
ChartSwitcher renders chips               ChartSwitcher returns null
"Deeper analysis" button                  "Explore alternatives" button
"Ask a follow-up" input                   Suggestion rows + "Something else…"
```

---

## Files Changed

| File | Change Type | Description |
|---|---|---|
| `api/explain.js` | Modified | + `SHORT_NODATA_PROMPT`, + `hasData()` helper, + no-data branch in short mode handler |
| `src/utils/parseAnalysis.js` | **New** | Shared `parseAnalysis(text)` → `{parsed, suggestions}` |
| `src/components/AnalysisBlock.jsx` | Modified | Refactor to use `parseAnalysis` util (no behavioral change) |
| `src/hooks/useAnalysis.js` | Modified | Detect no-data from response, store `noData` + `suggestions` on post/reply |
| `src/components/ChartSwitcher.jsx` | Modified | `if (post.noData) return null` |
| `src/components/PostCard.jsx` | Modified | Repurpose Deeper button, add suggestion rows, "Something else…" label on ReplyInput |
| `src/components/AIBubble.jsx` | Modified | Handle `reply.suggestions` chips |

---

## Testing

New unit tests required:
1. `parseAnalysis.test.js` — valid JSON, fence-wrapped JSON, no JSON, suggestions extraction
2. `AnalysisBlock.test.jsx` — add test: renders structured view when JSON has suggestions field (suggestions not rendered in DOM)
3. `ChartSwitcher.test.jsx` — add test: returns null when `post.noData === true`

Existing tests: no regressions expected. `AnalysisBlock` tests pass because `parseAnalysis` is a drop-in refactor.

---

## Non-Goals (explicitly excluded)

- Suggestions in `FULL_PROMPT` / "Deeper analysis" for data-rich posts (not needed)
- Client-side suggestion generation from meta (AI suggestions are higher quality)
- Showing the `reason` field to users (internal reasoning only)
- Changing the `clarifyOptions` mechanism (separate concern, left untouched)
