# UX Polish 8 — Reply Length + Clarify Quality Design

**Date:** 2026-03-01
**Status:** Approved

---

## Problem

Three related UX failures observed after v1.6 (clarification chips):

1. **Reply responses are too long** — `analyzeReply` defaults to `'full'` mode (2-3 paragraphs, 600 tokens). All non-deep responses should be 1 sentence.
2. **CLARIFY_PROMPT generates meta-chips** — For "Which project should I buy?", the clarify API returned markdown-fenced JSON which failed to parse, triggering the hardcoded fallback: `"Try different wording"` / `"Ask something else"`. These chips are not real estate data queries, so clicking them runs them through the intent pipeline and breaks.
3. **Hardcoded fallback chips are toxic** — When `JSON.parse` fails, the same bad chips are shown from three different locations in the code.

---

## Approach: Prompt fixes only (Approach A)

All fixes are in prompts and one mode argument — no architectural changes needed.

---

## Section 1: Reply length

### `api/explain.js` — `SHORT_PROMPT`

**Before:**
```
Write exactly 2-3 sentences summarizing the single most important insight with specific numbers.
```

**After:**
```
Write exactly 1 sentence with the single most important insight and the key number.
```

Reduce `max_tokens` for `short` mode: `150` → `80` (1 sentence ≈ 30–50 tokens; 80 gives comfortable headroom).

### `src/hooks/useAnalysis.js` — `analyzeReply`

`analyzeReply` currently calls `streamExplain` with no mode argument, which defaults to `'full'` (600 tokens, 2-3 paragraphs). Explicitly pass `'short'`:

```js
// Before
const fullText = await streamExplain(prompt, intent, summaryStats, signal)
patchReply(postId, replyId, { status: 'done', analysisText: fullText })

// After
const replyText = await streamExplain(prompt, intent, summaryStats, signal, 'short')
patchReply(postId, replyId, { status: 'done', analysisText: replyText })
```

`analyzeDeep` remains on `'full'` mode — that is the explicit "Deeper analysis" path.

---

## Section 2: Clarify chip quality

### `api/explain.js` — `CLARIFY_FALLBACK` constant

Extract all three hardcoded fallback sites into one constant with chips that ARE valid real estate data queries:

```js
const CLARIFY_FALLBACK = {
  question: 'What data interests you?',
  options: ['Price trends', 'Transaction volumes', 'District comparison'],
}
```

Replace all three inline `{ question: 'Could you rephrase that?', options: ['Try different wording', ...] }` literals with `CLARIFY_FALLBACK`.

### `api/explain.js` — `CLARIFY_PROMPT` overhaul

Current prompt doesn't tell Claude what the system can do, so it generates meta-chips and sometimes wraps output in markdown fences.

**New prompt:**
```
You are a friendly real estate data assistant for the Abu Dhabi property market.
The user asked a question this system cannot directly answer. This system can show: price trends, price-per-sqm trends, transaction volumes, project comparisons, district comparisons, and layout breakdowns.

Based on the user's question, return a JSON object with exactly two keys:
- "question": A short, warm clarifying question that steers toward what data would help (max 10 words, no trailing period, no markdown)
- "options": An array of 2–3 short strings (max 5 words each) that are real data queries the system can run

Good chips: "Price growth by project", "Most active projects", "By district volume"
Bad chips: "Try different wording", "Ask something else", "Rephrase your question"

Example for "Which project should I buy?":
{"question":"What data would help most?","options":["Price growth by project","Transaction volume","Price per sqm"]}

Rules:
- Never mention SQL, databases, or technical errors
- Options must be data requests, not meta-responses about rephrasing
- Return ONLY valid JSON — no markdown fences, no explanation text, nothing else
```

### `api/explain.js` — strip markdown fences defensively

Add one-line fence stripping before `JSON.parse` to handle model non-compliance:

```js
// Before
parsed = JSON.parse(rawText)

// After
const cleaned = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
parsed = JSON.parse(cleaned)
```

---

## Files changed

| File | Change |
|------|--------|
| `api/explain.js` | New `SHORT_PROMPT` (1 sentence), new `CLARIFY_PROMPT` (actionable chips), `CLARIFY_FALLBACK` constant, fence-stripping before JSON.parse, `max_tokens` short: 150→80 |
| `src/hooks/useAnalysis.js` | `analyzeReply` explicit `'short'` mode; rename local var `fullText` → `replyText` |

No UI changes. No store changes. No new tests needed beyond confirming 71/71 still pass.

---

## Success criteria

- All non-deep analysis responses are 1 sentence
- Clarify chips for recommendation queries are actionable data queries (e.g. "Price growth by project")
- Clicking a clarify chip produces a valid 1-sentence analysis with chart
- Fallback chips ("Price trends", "Transaction volumes", "District comparison") are valid queries the intent parser can handle
- No regressions in existing 71 tests
