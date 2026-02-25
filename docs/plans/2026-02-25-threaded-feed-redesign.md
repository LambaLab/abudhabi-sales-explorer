# Threaded Feed Redesign

**Date:** 2026-02-25
**Status:** Approved

---

## Problem Statement

1. **Disappearing post bug** — After a query completes, the post briefly appears then vanishes. Root cause: `pendingPost` lives in `useAnalysis` state while the finalised post lives in `usePostStore`. The `setPendingPost(null)` + `addPost(finalPost)` calls create a render gap where neither state holds the post, causing an empty-feed flash.

2. **UX is top-heavy** — The prompt input sits above the feed, forcing users to scroll back up to ask follow-ups. The feed order (newest-first, growing downward) is counter-intuitive for a conversational interface.

3. **No threading** — Each prompt is isolated. Users can't ask follow-up questions in context of a previous analysis.

---

## Approved Approach: Store-first, in-place patching (Approach A)

All posts — including in-progress ones — live in `usePostStore` with a `status` field. `useAnalysis` writes directly to the store at every stage, eliminating the separate `pendingPost` state and the associated flicker.

---

## Data Model

### Post (top-level)
```js
{
  id: string,          // crypto.randomUUID()
  createdAt: number,   // Date.now()
  prompt: string,
  title: string,
  status: 'analyzing' | 'querying' | 'explaining' | 'done' | 'error',
  error: string | null,
  analysisText: string,  // grows as stream arrives
  intent: object | null,
  chartData: array | null,
  chartKeys: array | null,
  replies: Reply[],
}
```

### Reply (nested inside a post)
```js
{
  id: string,
  createdAt: number,
  prompt: string,
  status: 'analyzing' | 'explaining' | 'done' | 'error',
  error: string | null,
  analysisText: string,
  intent: object | null,   // null = text-only reply (no DuckDB query)
  chartData: array | null,
  chartKeys: array | null,
}
```

The `intent` shape gains one field for replies:
```js
{ ..., chartNeeded: boolean }
```
When `chartNeeded = false`, the DuckDB query step is skipped entirely.

### Storage key
`ad_posts_v2` (schema change from v1 — incompatible, intentional migration reset)

---

## Store API

```js
usePostStore() → {
  posts,
  addPost(post),            // existing — insert new post at end (bottom of feed)
  removePost(id),           // existing
  getPost(id),              // existing
  patchPost(id, partial),   // NEW — merge partial into post by id
  addReply(postId, reply),  // NEW — push reply onto post.replies
  patchReply(postId, replyId, partial), // NEW — merge partial into reply
}
```

---

## Analysis Hook API

```js
useAnalysis(meta) → {
  analyze(prompt),               // top-level new post
  analyzeReply(postId, prompt),  // threaded follow-up
  activePostId,                  // id of currently running analysis (for UI disable)
}
```

`analyze(prompt)`:
1. `addPost({ id, status: 'analyzing', ... })` → immediately in store, no flicker
2. Fetch intent → `patchPost(id, { status: 'querying', intent })`
3. Run DuckDB → `patchPost(id, { status: 'explaining', chartData, chartKeys })`
4. Stream explain → `patchPost(id, { analysisText: growing })` on each chunk
5. Done → `patchPost(id, { status: 'done', analysisText: full })`

`analyzeReply(postId, prompt)`:
1. `addReply(postId, { id, status: 'analyzing', prompt, ... })`
2. Fetch intent (with parent context injected) → check `chartNeeded`
3. If `chartNeeded`: run DuckDB → `patchReply(..., { chartData, chartKeys })`
4. Stream explain (with parent analysis as context) → `patchReply(..., { analysisText: growing })`
5. Done → `patchReply(..., { status: 'done' })`

---

## Layout

```
┌──────────────────────────────────────┐
│  Abu Dhabi Sales Explorer     [db ●] │  ← sticky header
├──────────────────────────────────────┤
│  ↕ scrollable feed                   │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ POST (oldest at top)         │    │
│  │  title                       │    │
│  │  analysis text...            │    │
│  │  [Chart]                     │    │
│  │  ┄┄ REPLIES ┄┄┄┄┄┄┄┄┄┄┄┄┄  │    │
│  │  ↳ follow-up prompt          │    │
│  │     reply text...            │    │
│  │     [Chart if chartNeeded]   │    │
│  │  [↳ Ask a follow-up…  [→]]  │    │  ← inline reply input
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ POST (newest at bottom) ↓    │    │
│  └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│  [SmartTopics — horizontal scroll]   │  ← above bottom bar
│  ┌────────────────────────────[→]┐   │  ← sticky bottom input
│  │ Ask anything about Abu Dhabi… │   │
│  └───────────────────────────────┘   │
└──────────────────────────────────────┘
```

**Feed direction:** oldest-at-top, newest-at-bottom. Auto-scroll to bottom on new post.
**Bottom bar:** sticky, contains SmartTopics pills (horizontal scroll) + ChatInput.
**Reply input:** inline inside each PostCard, small textarea + send button, indented with a left border accent.

---

## Component Changes

| File | Change |
|------|--------|
| `usePostStore.js` | Add `patchPost`, `addReply`, `patchReply`; bump storage key to `v2` |
| `useAnalysis.js` | Remove `pendingPost` state; write to store directly; add `analyzeReply` |
| `api/analyze.js` | Accept optional `context` field; inject parent context into system prompt; add `chartNeeded` to response schema |
| `App.jsx` | Sticky bottom layout; move SmartTopics + ChatInput to fixed bottom bar; auto-scroll ref |
| `PostFeed.jsx` | Remove `pendingPost` prop; feed order is store order (addPost appends to end) |
| `PostCard.jsx` | Add `ReplyList` + inline `ReplyInput` section at bottom of card |
| `ReplyCard.jsx` | NEW — compact reply card (left-border accent, no share button, smaller text) |
| `SmartTopics.jsx` | Move into bottom bar; horizontal scroll; compact pill size |

---

## API: `/api/analyze` context extension

Request body gains optional `context` field:
```json
{
  "prompt": "follow-up text",
  "meta": { ... },
  "context": {
    "parentPrompt": "original question",
    "parentTitle": "3BR Prices: Al Reem vs Yas",
    "parentAnalysis": "first 500 chars of parent analysisText"
  }
}
```

When `context` is present:
- System prompt is extended: *"This is a follow-up to an existing analysis. Return `chartNeeded: false` if the question can be answered from the existing data context without a new chart."*
- Response schema gains: `"chartNeeded": true | false`

---

## Error Handling

- If `analyze` fails mid-flight: `patchPost(id, { status: 'error', error: message })`
- If `analyzeReply` fails: `patchReply(postId, replyId, { status: 'error', error: message })`
- Error state rendered inline in the post/reply card (red text, retry not implemented in v1)
- Abort on unmount and new-submission still uses `AbortController` per-run

---

## Testing

Existing 49 tests continue to pass (no changes to `queries.js`, `intentToQuery.js`, `deeplink.js`).

New unit tests:
- `usePostStore.test.js` — `patchPost`, `addReply`, `patchReply` with localStorage persistence
- `useAnalysis.test.js` — mock fetch/DuckDB; verify store patches at each pipeline stage; verify no flicker gap
