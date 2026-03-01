# Design: Clarification Chips — Conversational Clarify UX

**Date:** 2026-03-01
**Status:** Approved

---

## Problem

When the AI cannot interpret a query, it generates a long conversational paragraph asking for clarification (rendered identically to a normal analysis message). There is no visual distinction and no quick way for the user to respond — they must open the "Ask a follow-up" text input and type.

---

## Goal

1. Clarification messages should be **short and direct** — one question, ≤12 words, no preamble.
2. The AI generates **2–3 quick-reply option chips** the user can click instead of typing.
3. Everything stays contained inside the **PostCard** — no separate bottom-bar interaction needed.

---

## Approach: Structured JSON clarify response

Change `mode: 'clarify'` from a streaming prose response to a plain JSON response. The frontend parses it, stores the question and options on the post, and renders chips inside PostCard.

---

## Section 1: Data Model

### New post field

```js
// In usePostStore.js — add to the post schema:
clarifyOptions: null   // string[] when clarification needed, null otherwise
```

`post.analysisText` continues to hold the question text (short, ≤12 words).
`post.clarifyOptions` holds the option strings (2–3 items, 2–6 words each).

---

## Section 2: API — `api/explain.js`

### Mode 'clarify' — change from streaming to JSON

**Before:** Streamed prose via SSE (`text/event-stream`).

**After:** Plain JSON response (`application/json`):

```json
{
  "question": "Rank by which metric?",
  "options": ["Average 3-bed price", "Sales volume", "Number of transactions"]
}
```

### New system prompt for clarify mode

```
You are a concise data analyst. The user's query was ambiguous or returned no results.

Return a JSON object with exactly these two keys:
- "question": one short question (≤12 words, no preamble — start directly with the question)
- "options": array of 2-3 short answer strings (2-6 words each)

Example:
{"question": "Rank by which metric?", "options": ["Average 3-bed price", "Sales volume", "Number of transactions"]}

Return only valid JSON. No other text.
```

### Response format change

```js
// api/explain.js — clarify mode
// Before:
res.writeHead(200, { 'Content-Type': 'text/event-stream' })
// ... stream prose ...

// After:
const content = await claude.messages.create({ ... })  // non-streaming
const json = JSON.parse(content.content[0].text)
res.json({ question: json.question, options: json.options })
```

---

## Section 3: Frontend — `useAnalysis.js`

### New `fetchClarify` function

```js
async function fetchClarify(prompt, signal) {
  const res = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, mode: 'clarify' }),
    signal,
  })
  if (!res.ok) throw new Error('clarify failed')
  return res.json()  // { question, options }
}
```

### In `analyze()` catch block

```js
// Before:
await streamExplain(prompt, null, {}, signal, 'clarify')
// (fills post.analysisText via streaming, status → 'done')

// After:
const { question, options } = await fetchClarify(prompt, signal)
patchPost(placeholder.id, {
  analysisText:   question,
  clarifyOptions: options,
  status:         'done',
})
```

---

## Section 4: PostCard UI

### Chip rendering

Chips appear **below the analysis text** when:
- `post.clarifyOptions?.length > 0` — clarification was returned
- `post.replies.length === 0` — no reply has been made yet

Once any reply exists (chip clicked OR text typed), chips disappear — they're no longer needed.

```jsx
{/* Clarification option chips */}
{post.clarifyOptions?.length > 0 && post.replies.length === 0 && (
  <div className="flex flex-wrap gap-2 mt-3">
    {post.clarifyOptions.map((opt, i) => (
      <button
        key={i}
        type="button"
        onClick={() => onReply(post.id, opt)}
        disabled={isReplying}
        className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
      >
        {opt}
      </button>
    ))}
  </div>
)}
```

Where `isReplying` is `activePostId !== null` (already available via props).

### Chip placement in PostCard layout

```
┌─────────────────────────────────────────────────────┐
│ just now                                        ⎘   │
│ Top 10 Projects by Avg 3-Bed Price in 2025          │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ "Give me the average prices of 3bedrooms..."    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Rank by which metric?                               │
│                                                     │
│ ╭──────────────────╮ ╭──────────────╮ ╭──────────╮ │
│ │ Average 3-bed    │ │ Sales volume │ │ Transact.│ │
│ │ price            │ ╰──────────────╯ ╰──────────╯ │
│ ╰──────────────────╯                               │
│                                                     │
│  ╰ Deeper analysis    ╰ Ask a follow-up ──────────  │
└─────────────────────────────────────────────────────┘
```

---

## Files Changed

| File | Change |
|------|--------|
| `api/explain.js` | Mode 'clarify': switch from SSE streaming to plain JSON; new system prompt |
| `src/hooks/useAnalysis.js` | Add `fetchClarify()`; replace `streamExplain(...'clarify')` call in catch block |
| `src/hooks/usePostStore.js` | Add `clarifyOptions: null` to post schema |
| `src/components/PostCard.jsx` | Render clarification chips below analysisText when `clarifyOptions` present |

---

## Success Criteria

1. When a query is ambiguous/fails, the post shows a ≤12-word question (not a long paragraph)
2. 2–3 chip buttons appear below the question inside the PostCard
3. Clicking a chip fires the same `analyzeReply()` path as typing a follow-up
4. The "Ask a follow-up" text input remains available alongside chips
5. Chips disappear once any reply exists
6. Chips are disabled while a reply is in-flight
7. Normal (non-clarify) posts are unaffected
8. 67/67 tests pass
