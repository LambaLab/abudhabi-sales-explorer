# Chat Bubbles Design — v1.8

**Date:** 2026-03-01
**Status:** Approved
**Scope:** Reply thread only (original post card unchanged)

---

## Problem

The current reply thread uses an indented border-left block with a quoted user prompt and plain AI text below. This does not read as a conversation — it is document-like, hard to scan, and loses the interactive chat feel.

## Goal

Convert the reply thread inside each PostCard into a conversational chat bubble UI — user messages right-aligned (accent), AI responses left-aligned (slate) — with a max-height scroll container so cards don't grow unbounded.

---

## Decisions Summary

| Question | Decision |
|---|---|
| Scope | Replies only — original card unchanged |
| Height cap | `max-h-[420px] overflow-y-auto` on reply thread |
| Auto-scroll | Always, on reply `status → 'done'` |
| Follow-up input | Sticky below scroll area, still collapsible |
| User bubble color | Accent bg, white text |
| AI bubble color | Slate-100 / slate-800 (dark) |
| Avatars | Yes — person icon (user), octopus logo (AI) |
| Bubble max width | 80% of card width |
| Bubble shape | Soft rounded rect (~12px, `rounded-xl`) |
| Charts | Below AI bubble, full width, outside bubble |
| Chips | Inline below AI bubble, outside bubble |
| Streaming | Typing indicator + status label → full text on done |
| Timestamps | Yes — relative (`"just now"`, `"2 min ago"`) |
| Deeper Analysis | Unchanged — stays outside chat thread |
| Scroll isolation | Inner scroll only (post card fixed height) |

---

## Component Architecture

### New Components

**`src/components/UserBubble.jsx`**
- Props: `{ prompt, createdAt }`
- Layout: `flex justify-end gap-2 items-end`
- Avatar: 24×24 circle, person SVG icon, slate bg
- Bubble: `max-w-[80%] rounded-xl bg-accent text-white px-3.5 py-2.5 text-sm leading-relaxed`
- Timestamp: `text-xs text-slate-400 mt-1 text-right`

**`src/components/AIBubble.jsx`**
- Props: `{ reply }` (full reply object)
- Layout: `flex justify-start gap-2 items-end`
- Avatar: 24×24 circle, octopus logo (existing `octopus.svg` or `<img>`)
- Bubble: `max-w-[80%] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-sm leading-relaxed`
- **Loading state** (status ≠ 'done' and ≠ 'error'):
  - Three-dot animation inside bubble
  - Muted status label below bubble (see state table)
- **Done state**: `reply.analysisText` + relative timestamp below bubble
- **Error state**: error text in bubble with muted red tint
- Chart rendered below the entire bubble row (full width)
- Clarify chips rendered below the bubble row (pill buttons, existing style)

### Modified Components

**`src/components/ReplyCard.jsx`**
Becomes a thin wrapper:
```jsx
<div className="space-y-3">
  <UserBubble prompt={reply.prompt} createdAt={reply.createdAt} />
  <AIBubble reply={reply} />
</div>
```

**`src/components/PostCard.jsx`**
- Reply thread container: add `max-h-[420px] overflow-y-auto scroll-smooth`
- Add `bottomRef` sentinel div at end of reply list
- Add `useEffect` to call `bottomRef.current?.scrollIntoView({ behavior: 'smooth' })` when last reply status becomes `'done'`
- `ReplyInput` moves to `sticky bottom-0` below the scroll container (inside the card)

---

## State → UI Mapping

| `reply.status` | AIBubble shows |
|---|---|
| `'analyzing'` | Three dots + label "Analyzing…" |
| `'querying'` | Three dots + label "Querying data…" |
| `'explaining'` | Three dots + label "Writing…" |
| `'done'` | Full `analysisText` + timestamp |
| `'error'` | `reply.error` text in muted red |

---

## Edge Cases

- **Clarify flow**: `reply.analysisText` = clarify question (normal text in AIBubble), chips rendered below as today; clicking chip calls `onReply(postId, chip)`
- **Chart + text**: 1-sentence text in bubble, chart card full-width below bubble row, always visible (not inside scroll-limited bubble)
- **0 replies**: thread container hidden, no scroll container rendered; `ReplyInput` in its collapsed state as today
- **1–2 replies**: post grows naturally (below 420px threshold)
- **3+ replies**: scroll container activates when content exceeds 420px

---

## Timestamp Implementation

Simple static relative time on mount from `reply.createdAt`:
```js
function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}
```
Rendered statically (no interval update — fine for this use case).

---

## Testing

- Existing 71 tests must continue to pass (hook logic untouched)
- New render tests for `UserBubble` and `AIBubble`:
  - UserBubble renders prompt text + avatar
  - AIBubble renders typing indicator when status = 'analyzing'
  - AIBubble renders full text when status = 'done'
  - AIBubble renders chips when `reply.clarifyOptions` present
- `ReplyCard` smoke test: renders both bubbles

---

## Files Changed

| File | Change |
|---|---|
| `src/components/UserBubble.jsx` | **New** |
| `src/components/AIBubble.jsx` | **New** |
| `src/components/ReplyCard.jsx` | **Rewrite** (thin wrapper) |
| `src/components/PostCard.jsx` | **Modify** (scroll container, auto-scroll, sticky input) |

No changes to: `useAnalysis.js`, `usePostStore.js`, `api/explain.js`, or any other files.
