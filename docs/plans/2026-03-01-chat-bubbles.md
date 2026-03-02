# Chat Bubbles (v1.8) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the reply thread in each PostCard into a conversational chat UI: right-aligned user bubbles (accent) and left-aligned AI bubbles (slate), with a 420px max-height scroll container and auto-scroll.

**Architecture:** Two new leaf components (`UserBubble`, `AIBubble`) composed by a rewritten `ReplyCard` (thin wrapper). `PostCard` gains a scroll container + auto-scroll `useEffect`. No changes to hooks, API, or data models.

**Tech Stack:** React 19, Tailwind v4, Vitest + @testing-library/react

---

### Task 1: UserBubble component

**Files:**
- Create: `src/components/UserBubble.jsx`
- Create: `src/components/UserBubble.test.jsx`

**Step 1: Write the failing test**

```jsx
// src/components/UserBubble.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserBubble } from './UserBubble'

describe('UserBubble', () => {
  it('renders the user prompt text', () => {
    render(<UserBubble prompt="Which project is best?" createdAt={Date.now()} />)
    expect(screen.getByText('Which project is best?')).toBeTruthy()
  })

  it('renders a relative timestamp', () => {
    render(<UserBubble prompt="test" createdAt={Date.now()} />)
    expect(screen.getByText(/ago|now/i)).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

```
node node_modules/.bin/vitest run src/components/UserBubble.test.jsx
```

Expected: FAIL — "Cannot find module './UserBubble'"

**Step 3: Write implementation**

```jsx
// src/components/UserBubble.jsx

function relativeTime(ts) {
  const diff = Date.now() - ts
  if (diff < 60_000)    return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

export function UserBubble({ prompt, createdAt }) {
  return (
    <div className="flex justify-end items-end gap-2">
      <div className="flex flex-col items-end max-w-[80%]">
        <div className="rounded-xl bg-accent text-white px-3.5 py-2.5 text-sm leading-relaxed">
          {prompt}
        </div>
        <p className="text-xs text-slate-400 mt-1">{relativeTime(createdAt)}</p>
      </div>
      {/* Avatar */}
      <div className="shrink-0 h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
        <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
        </svg>
      </div>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```
node node_modules/.bin/vitest run src/components/UserBubble.test.jsx
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/components/UserBubble.jsx src/components/UserBubble.test.jsx
git commit -m "feat(ui): UserBubble component — right-aligned accent chat bubble"
```

---

### Task 2: AIBubble component

**Files:**
- Create: `src/components/AIBubble.jsx`
- Create: `src/components/AIBubble.test.jsx`

**Step 1: Write the failing tests**

```jsx
// src/components/AIBubble.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AIBubble } from './AIBubble'

// Recharts doesn't work in jsdom — mock DynamicChart
vi.mock('./charts/DynamicChart', () => ({
  DynamicChart: () => <div data-testid="chart-mock" />,
}))

const BASE = {
  id: 'r1',
  createdAt: Date.now(),
  prompt: 'What trends?',
  status: 'done',
  analysisText: 'Prices rose 12% in Q1.',
  chartData: null,
  chartKeys: null,
  intent: null,
  clarifyOptions: null,
  error: null,
}

describe('AIBubble', () => {
  it('shows analysisText when status is done', () => {
    render(<AIBubble reply={BASE} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Prices rose 12% in Q1.')).toBeTruthy()
  })

  it('shows "Analyzing…" label when status is analyzing', () => {
    render(<AIBubble reply={{ ...BASE, status: 'analyzing', analysisText: null }} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Analyzing…')).toBeTruthy()
  })

  it('shows "Querying data…" label when status is querying', () => {
    render(<AIBubble reply={{ ...BASE, status: 'querying', analysisText: null }} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Querying data…')).toBeTruthy()
  })

  it('shows "Writing…" label when status is explaining', () => {
    render(<AIBubble reply={{ ...BASE, status: 'explaining', analysisText: null }} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Writing…')).toBeTruthy()
  })

  it('renders chart mock when chartData is present', () => {
    render(<AIBubble reply={{ ...BASE, chartData: [{ x: 1 }] }} onReply={() => {}} postId="p1" />)
    expect(screen.getByTestId('chart-mock')).toBeTruthy()
  })

  it('renders clarify chips when clarifyOptions present', () => {
    render(<AIBubble
      reply={{ ...BASE, clarifyOptions: ['Price trends', 'Volume'] }}
      onReply={() => {}}
      postId="p1"
    />)
    expect(screen.getByText('Price trends')).toBeTruthy()
    expect(screen.getByText('Volume')).toBeTruthy()
  })

  it('calls onReply(postId, chip) when chip is clicked', () => {
    const onReply = vi.fn()
    render(<AIBubble
      reply={{ ...BASE, clarifyOptions: ['Price trends'] }}
      onReply={onReply}
      postId="p1"
    />)
    screen.getByText('Price trends').click()
    expect(onReply).toHaveBeenCalledWith('p1', 'Price trends')
  })

  it('shows error text when status is error', () => {
    render(<AIBubble reply={{ ...BASE, status: 'error', error: 'Failed to load' }} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Failed to load')).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

```
node node_modules/.bin/vitest run src/components/AIBubble.test.jsx
```

Expected: FAIL — "Cannot find module './AIBubble'"

**Step 3: Write implementation**

```jsx
// src/components/AIBubble.jsx
import { DynamicChart } from './charts/DynamicChart'

const STATUS_LABELS = {
  analyzing: 'Analyzing…',
  querying:  'Querying data…',
  explaining: 'Writing…',
}

function relativeTime(ts) {
  const diff = Date.now() - ts
  if (diff < 60_000)    return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

function TypingIndicator({ status }) {
  return (
    <div>
      <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
        <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
        <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
      </div>
      {STATUS_LABELS[status] && (
        <p className="text-xs text-slate-400 mt-1 ml-1">{STATUS_LABELS[status]}</p>
      )}
    </div>
  )
}

export function AIBubble({ reply, onReply, postId }) {
  const isLoading = reply.status === 'analyzing' || reply.status === 'querying' || reply.status === 'explaining'
  const isError   = reply.status === 'error'

  return (
    <div className="space-y-2">
      {/* Bubble row */}
      <div className="flex justify-start items-end gap-2">
        {/* Octopus avatar */}
        <div className="shrink-0 h-6 w-6 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <img src="/octopus.svg" alt="AI" className="h-full w-full object-contain p-0.5" />
        </div>

        <div className="max-w-[80%]">
          {isLoading ? (
            <TypingIndicator status={reply.status} />
          ) : isError ? (
            <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-red-400 leading-relaxed">
              {reply.error ?? 'Something went wrong.'}
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-sm leading-relaxed">
                {reply.analysisText}
              </div>
              <p className="text-xs text-slate-400 mt-1">{relativeTime(reply.createdAt)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Chart — full width, below bubble, indented to align with bubble */}
      {reply.chartData?.length > 0 && (
        <div className="ml-8">
          <DynamicChart
            intent={reply.intent}
            chartData={reply.chartData}
            chartKeys={reply.chartKeys}
          />
        </div>
      )}

      {/* Clarify chips — inline below bubble */}
      {reply.clarifyOptions?.length > 0 && (
        <div className="flex flex-wrap gap-2 ml-8">
          {reply.clarifyOptions.map((option, i) => (
            <button
              key={`${i}-${option}`}
              type="button"
              onClick={() => onReply(postId, option)}
              className="rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:border-accent hover:text-accent transition-colors"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```
node node_modules/.bin/vitest run src/components/AIBubble.test.jsx
```

Expected: PASS (8 tests)

**Step 5: Commit**

```bash
git add src/components/AIBubble.jsx src/components/AIBubble.test.jsx
git commit -m "feat(ui): AIBubble — left-aligned slate bubble with typing indicator, chips, and chart"
```

---

### Task 3: Rewrite ReplyCard as thin wrapper

**Files:**
- Modify: `src/components/ReplyCard.jsx`
- Create: `src/components/ReplyCard.test.jsx`

**Step 1: Write the failing test**

```jsx
// src/components/ReplyCard.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReplyCard } from './ReplyCard'

vi.mock('./charts/DynamicChart', () => ({
  DynamicChart: () => <div data-testid="chart-mock" />,
}))

const REPLY = {
  id: 'r1',
  createdAt: Date.now(),
  prompt: 'What about studios?',
  status: 'done',
  analysisText: 'Studios averaged AED 850k.',
  chartData: null,
  chartKeys: null,
  intent: null,
  clarifyOptions: null,
  error: null,
}

describe('ReplyCard', () => {
  it('renders user prompt via UserBubble', () => {
    render(<ReplyCard reply={REPLY} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('What about studios?')).toBeTruthy()
  })

  it('renders AI analysisText via AIBubble', () => {
    render(<ReplyCard reply={REPLY} onReply={() => {}} postId="p1" />)
    expect(screen.getByText('Studios averaged AED 850k.')).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

```
node node_modules/.bin/vitest run src/components/ReplyCard.test.jsx
```

Expected: FAIL — current ReplyCard renders neither UserBubble nor AIBubble structure

**Step 3: Rewrite ReplyCard**

```jsx
// src/components/ReplyCard.jsx
import { UserBubble } from './UserBubble'
import { AIBubble }   from './AIBubble'

export function ReplyCard({ reply, onReply, postId }) {
  return (
    <div className="space-y-3">
      <UserBubble prompt={reply.prompt} createdAt={reply.createdAt} />
      <AIBubble reply={reply} onReply={onReply} postId={postId} />
    </div>
  )
}
```

**Step 4: Run ReplyCard tests**

```
node node_modules/.bin/vitest run src/components/ReplyCard.test.jsx
```

Expected: PASS (2 tests)

**Step 5: Run full suite to check for regressions**

```
node node_modules/.bin/vitest run
```

Expected: all prior tests still passing

**Step 6: Commit**

```bash
git add src/components/ReplyCard.jsx src/components/ReplyCard.test.jsx
git commit -m "refactor(ui): ReplyCard → thin wrapper over UserBubble + AIBubble"
```

---

### Task 4: PostCard — scroll container, auto-scroll, thread onReply wiring

**Files:**
- Modify: `src/components/PostCard.jsx`

**Context:** `PostCard` currently renders replies as:
```jsx
{post.replies?.length > 0 && (
  <div className="space-y-4 pt-1 border-t border-slate-700/40">
    {post.replies.map(reply => (
      <ReplyCard key={reply.id} reply={reply} />
    ))}
  </div>
)}
```
It also already imports `useRef` and `useEffect` at the top.

**Step 1: Add `bottomRef` and auto-scroll effect**

In `PostCard`'s function body, after the existing `useRef`/`useState` declarations (around line 113-115), add:

```js
const bottomRef = useRef(null)

// Auto-scroll to latest reply when it finishes streaming
const lastReply = post.replies?.at(-1)
useEffect(() => {
  if (lastReply?.status === 'done') {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}, [lastReply?.status])
```

**Step 2: Replace reply thread container**

Find and replace the reply thread block:

**Old:**
```jsx
{post.replies?.length > 0 && (
  <div className="space-y-4 pt-1 border-t border-slate-700/40">
    {post.replies.map(reply => (
      <ReplyCard key={reply.id} reply={reply} />
    ))}
  </div>
)}
```

**New:**
```jsx
{post.replies?.length > 0 && (
  <div className="border-t border-slate-200 dark:border-slate-700/40 pt-2">
    <div className="max-h-[420px] overflow-y-auto scroll-smooth space-y-3 pr-1">
      {post.replies.map(reply => (
        <ReplyCard key={reply.id} reply={reply} onReply={onReply} postId={post.id} />
      ))}
      <div ref={bottomRef} />
    </div>
  </div>
)}
```

**Note:** `onReply` is already in scope as a prop of `PostCard`. `post.id` is available on the `post` prop.

**Step 3: Run full test suite**

```
node node_modules/.bin/vitest run
```

Expected: 83 tests passing (71 existing + 2 UserBubble + 8 AIBubble + 2 ReplyCard = 83)

**Step 4: Verify in browser**

```
node node_modules/.bin/vite
```

Open http://localhost:5173 and test:
- [ ] Submit a query → replies appear as chat bubbles (user right/accent, AI left/slate)
- [ ] While AI is responding: typing indicator (three dots) + label "Analyzing…" / "Querying data…" / "Writing…"
- [ ] After reply arrives: full 1-sentence text in bubble + timestamp ("just now")
- [ ] Post card does not scroll when < 3 replies; scrollbar appears when content exceeds 420px
- [ ] Auto-scrolls to latest bubble on each new reply

**Step 5: Commit**

```bash
git add src/components/PostCard.jsx
git commit -m "feat(ui): PostCard scroll container + auto-scroll for chat thread"
```

---

### Task 5: Version bump + push

**Files:**
- Modify: `package.json` — `"version": "1.7"` → `"version": "1.8"`

**Step 1: Update version in package.json**

Change line:
```json
"version": "1.7",
```
to:
```json
"version": "1.8",
```

**Step 2: Run full suite one final time**

```
node node_modules/.bin/vitest run
```

Expected: all 83 tests passing

**Step 3: Commit and push**

```bash
git add package.json
git commit -m "chore: bump version to 1.8 (chat bubbles)"
git push origin main
```
