# Reply Polish + Query Block Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the question/query text clearly visible in both main cards and reply cards, upgrade reply card readability, and fix the reply analysis data-context bug that causes replies to say "I have no data" about data the parent post already analyzed.

**Architecture:** Three independent file edits — PostCard.jsx (swap italic prompt line for block-quote), ReplyCard.jsx (same block-quote + body text upgrade), useAnalysis.js (seed `summaryStats` from parent post before running new query). No new hooks, no new components, no shared state changes.

**Tech Stack:** React 18, Tailwind CSS v4, Vitest

---

### Task 1: `PostCard.jsx` — Replace truncated italic prompt with block-quote

**Files:**
- Modify: `src/components/PostCard.jsx`

**Context:** Line 144-146 currently shows the original question as a tiny, italic, grey, truncated line below the title. Replace with a styled block-quote div so the question is legible.

**Step 1: Read the current file**
```bash
cat /Users/nagi/abudhabi-sales-explorer/src/components/PostCard.jsx
```
Confirm the exact lines around the prompt display (should be around line 144):
```jsx
{post.title && post.title !== post.prompt && (
  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 italic truncate">"{post.prompt}"</p>
)}
```

**Step 2: Replace the italic prompt line with a block-quote**

Change:
```jsx
          {post.title && post.title !== post.prompt && (
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 italic truncate">"{post.prompt}"</p>
          )}
```

To:
```jsx
          {post.title && post.title !== post.prompt && (
            <div className="mt-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border-l-2 border-accent px-3 py-2">
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">"{post.prompt}"</p>
            </div>
          )}
```

**Step 3: Run tests (no tests for this component — just confirm they still pass)**
```bash
cd /Users/nagi/abudhabi-sales-explorer && export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && npx vitest run 2>&1
```
Expected: All 67 tests pass.

**Step 4: Commit**
```bash
git add src/components/PostCard.jsx
git commit -m "style: replace truncated italic prompt with block-quote in PostCard"
```

---

### Task 2: `ReplyCard.jsx` — Block-quote prompt + body text upgrade

**Files:**
- Modify: `src/components/ReplyCard.jsx`

**Context:** The full current file:
```jsx
import { DynamicChart } from './charts/DynamicChart'
import { ThinkingLabel } from './ThinkingLabel'

export function ReplyCard({ reply }) {
  const isLoading = reply.status === 'analyzing' || reply.status === 'querying' || reply.status === 'explaining'

  return (
    <div className="ml-2 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-2">
      {/* Follow-up prompt label */}
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
        ↳ <span className="text-slate-700 dark:text-slate-300">{reply.prompt}</span>
      </p>

      {/* Content */}
      {reply.error ? (
        <p className="text-xs text-red-400">{reply.error}</p>
      ) : isLoading && !reply.analysisText ? (
        <ThinkingLabel />
      ) : (
        <>
          {reply.analysisText ? (
            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {reply.analysisText}
            </div>
          ) : null}

          {reply.chartData?.length > 0 && (
            <div className="mt-2">
              <DynamicChart
                intent={reply.intent}
                chartData={reply.chartData}
                chartKeys={reply.chartKeys}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

**Step 1: Replace the entire file with this full implementation**

```jsx
import { DynamicChart } from './charts/DynamicChart'
import { ThinkingLabel } from './ThinkingLabel'

/**
 * Reply card rendered inside a PostCard thread.
 * Left-border indent, same text size as main post, block-quote prompt.
 */
export function ReplyCard({ reply }) {
  const isLoading = reply.status === 'analyzing' || reply.status === 'querying' || reply.status === 'explaining'

  return (
    <div className="ml-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-3">
      {/* Follow-up prompt — block-quote style, softer accent */}
      <div className="rounded-md bg-slate-50 dark:bg-slate-800/40 border-l-2 border-accent/60 px-2.5 py-1.5">
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">"{reply.prompt}"</p>
      </div>

      {/* Content */}
      {reply.error ? (
        <p className="text-sm text-red-400">{reply.error}</p>
      ) : isLoading && !reply.analysisText ? (
        <ThinkingLabel />
      ) : (
        <>
          {reply.analysisText ? (
            <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {reply.analysisText}
            </div>
          ) : null}

          {reply.chartData?.length > 0 && (
            <div className="mt-2">
              <DynamicChart
                intent={reply.intent}
                chartData={reply.chartData}
                chartKeys={reply.chartKeys}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

Changes from old version:
- `ml-2 pl-3` → `ml-2 pl-4` (slightly wider indent)
- `space-y-2` → `space-y-3` (more breathing room)
- Prompt: `↳ text-xs` → block-quote div matching PostCard style but `border-accent/60` (softer)
- Body: `text-xs text-slate-700` → `text-sm text-slate-800 dark:text-slate-200`
- Error: `text-xs` → `text-sm`

**Step 2: Run tests**
```bash
cd /Users/nagi/abudhabi-sales-explorer && export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && npx vitest run 2>&1
```
Expected: All 67 tests pass.

**Step 3: Commit**
```bash
git add src/components/ReplyCard.jsx
git commit -m "style: upgrade ReplyCard — block-quote prompt, text-sm body, more spacing"
```

---

### Task 3: `useAnalysis.js` — Seed reply summaryStats from parent post

**Files:**
- Modify: `src/hooks/useAnalysis.js`

**Context:** When a user asks a follow-up like "what did you mean by AED 3,175,000?", Claude sets `chartNeeded: false` (no new query needed). The current code leaves `summaryStats = {}`, so `/api/explain` receives empty KEY DATA and the grounding clause forces the model to say "I have no data." The fix: seed `summaryStats` from the parent post's already-stored `summaryStats`, then only override it if a new DuckDB query runs AND returns rows.

Current code in `analyzeReply` (around line 223-239):
```js
    let chartData    = null
    let chartKeys    = null
    let summaryStats = {}

    // ── Step 2: optionally skip DuckDB if Claude says no chart needed ──
    if (intent.chartNeeded !== false) {
      const { sql, params } = intentToQuery(intent)
      if (sql) {
        const rawRows = await query(sql, params)
        const pivoted = pivotChartData(rawRows, intent)
        chartData    = pivoted.chartData
        chartKeys    = pivoted.chartKeys
        summaryStats = computeSummaryStats(rawRows, intent)
      }
    }
```

**Step 1: Read the current file around lines 218-245 to confirm the exact text**
```bash
sed -n '218,245p' /Users/nagi/abudhabi-sales-explorer/src/hooks/useAnalysis.js
```

**Step 2: Apply the targeted change**

Change:
```js
    let chartData    = null
    let chartKeys    = null
    let summaryStats = {}

    // ── Step 2: optionally skip DuckDB if Claude says no chart needed ──
    if (intent.chartNeeded !== false) {
      const { sql, params } = intentToQuery(intent)
      // If no SQL is generated (e.g. unsupported query type), skip silently —
      // replies are conversational, so streaming text without a chart is fine.
      if (sql) {
        const rawRows = await query(sql, params)
        const pivoted = pivotChartData(rawRows, intent)
        chartData    = pivoted.chartData
        chartKeys    = pivoted.chartKeys
        summaryStats = computeSummaryStats(rawRows, intent)
      }
    }
```

To:
```js
    let chartData    = null
    let chartKeys    = null
    // Seed from parent so conversational replies can reference parent's data.
    // Overridden below only if a fresh query returns rows.
    let summaryStats = parent?.summaryStats ?? {}

    // ── Step 2: optionally skip DuckDB if Claude says no chart needed ──
    if (intent.chartNeeded !== false) {
      const { sql, params } = intentToQuery(intent)
      // If no SQL is generated (e.g. unsupported query type), skip silently —
      // replies are conversational, so streaming text without a chart is fine.
      if (sql) {
        const rawRows = await query(sql, params)
        const pivoted = pivotChartData(rawRows, intent)
        chartData    = pivoted.chartData
        chartKeys    = pivoted.chartKeys
        // Only override parent stats if new query actually returned data.
        if (rawRows.length > 0) {
          summaryStats = computeSummaryStats(rawRows, intent)
        }
      }
    }
```

**Step 3: Run tests**
```bash
cd /Users/nagi/abudhabi-sales-explorer && export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && npx vitest run 2>&1
```
Expected: All 67 tests pass.

**Step 4: Commit + push**
```bash
git add src/hooks/useAnalysis.js
git commit -m "fix: seed reply summaryStats from parent post so follow-ups have data context"
git push origin main
```

---

## Final Verification

```bash
cd /Users/nagi/abudhabi-sales-explorer && export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && npx vitest run 2>&1
```

All 67 tests pass.

Visually verify in the deployed app:
- [ ] Main card: question shows as a styled block-quote below the title (not italic, not truncated)
- [ ] Reply card: question shows as a block-quote with softer accent color
- [ ] Reply card: analysis text is `text-sm`, same readable size as main cards
- [ ] Follow-up asking "what did you mean by X?" actually answers using the parent's data instead of saying "no data"
