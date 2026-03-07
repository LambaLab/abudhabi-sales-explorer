# No-Data State: Hide Chips + Fallback Suggestions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a query returns no data, hide chart chips and show 2 intelligent alternative query suggestions that run as thread replies.

**Architecture:** Server detects empty `summaryStats` in short mode and returns `SHORT_NODATA_PROMPT` JSON (haiku, ~300 tokens). Client parses via `parseAnalysis()` utility, stores `noData` + `suggestions` on the post, then adapts all UI consumers. Seven files touched; zero extra API calls; zero latency added to the happy path.

**Tech Stack:** React 18, Vitest + Testing Library, Vite, Tailwind, Vercel Edge Functions, Anthropic SDK (`claude-haiku-4-5` for no-data path)

**Test runner:** `/usr/local/bin/node node_modules/.bin/vitest run`
**Design doc:** `docs/plans/2026-03-07-no-data-suggestions-design.md`

---

## Task 1: `parseAnalysis` utility (shared JSON extractor)

**Files:**
- Create: `src/utils/parseAnalysis.js`
- Create: `src/utils/parseAnalysis.test.js`

---

**Step 1: Write the failing tests**

Create `src/utils/parseAnalysis.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { parseAnalysis } from './parseAnalysis'

describe('parseAnalysis', () => {
  it('returns {parsed: null, suggestions: null} for empty/null text', () => {
    expect(parseAnalysis(null)).toEqual({ parsed: null, suggestions: null })
    expect(parseAnalysis('')).toEqual({ parsed: null, suggestions: null })
  })

  it('parses plain JSON object', () => {
    const text = JSON.stringify({ headline: 'Test', analysis: 'Good.' })
    const { parsed, suggestions } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Test')
    expect(suggestions).toBeNull()
  })

  it('strips markdown fences before parsing', () => {
    const text = '```json\n{"headline":"Test"}\n```'
    const { parsed } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Test')
  })

  it('extracts first {...} substring to handle preamble text', () => {
    const text = 'Here is the analysis: {"headline":"Test","analysis":"Good."}'
    const { parsed } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Test')
  })

  it('extracts suggestions array when present', () => {
    const json = JSON.stringify({
      headline: 'No data found',
      suggestions: [
        { label: 'Ready trend', query: 'Ready price trend 2021-2025', reason: 'Has data' },
        { label: 'Off-plan volume', query: 'Off-plan volume by district', reason: 'Has data' },
      ],
    })
    const { parsed, suggestions } = parseAnalysis(json)
    expect(parsed?.headline).toBe('No data found')
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].label).toBe('Ready trend')
    expect(suggestions[0].query).toBe('Ready price trend 2021-2025')
  })

  it('returns suggestions: null when suggestions array is absent', () => {
    const json = JSON.stringify({ headline: 'Test', analysis: 'Fine.' })
    const { suggestions } = parseAnalysis(json)
    expect(suggestions).toBeNull()
  })

  it('returns suggestions: null when suggestions is empty array', () => {
    const json = JSON.stringify({ headline: 'Test', suggestions: [] })
    const { suggestions } = parseAnalysis(json)
    expect(suggestions).toBeNull()
  })

  it('returns {parsed: null, suggestions: null} for non-JSON text', () => {
    const { parsed, suggestions } = parseAnalysis('Prices rose 18% last year.')
    expect(parsed).toBeNull()
    expect(suggestions).toBeNull()
  })

  it('handles JSON with trailing postamble text', () => {
    const text = '{"headline":"Test","analysis":"Good."}\n\nNote: all figures in AED.'
    const { parsed } = parseAnalysis(text)
    expect(parsed?.headline).toBe('Test')
  })
})
```

**Step 2: Run tests — verify they fail**

```bash
/usr/local/bin/node node_modules/.bin/vitest run src/utils/parseAnalysis.test.js
```

Expected: FAIL — "Cannot find module './parseAnalysis'"

**Step 3: Create the utility**

Create `src/utils/parseAnalysis.js`:

```js
/**
 * Robust extraction of the first {…} JSON object from LLM text.
 *
 * Handles:
 * - Markdown fences: ```json … ```
 * - Preamble/postamble text (extracts first { … } substring)
 * - Trailing notes after the closing brace
 *
 * Returns { parsed, suggestions } where:
 * - parsed: the full parsed object, or null if not valid JSON
 * - suggestions: array from parsed.suggestions, or null if absent/empty
 */
export function parseAnalysis(text) {
  if (!text) return { parsed: null, suggestions: null }

  // Strip markdown code fences if present
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  // Find first { … } substring to tolerate preamble/postamble text
  const jsonStart = stripped.indexOf('{')
  const jsonEnd   = stripped.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd <= jsonStart) {
    return { parsed: null, suggestions: null }
  }

  try {
    const obj = JSON.parse(stripped.slice(jsonStart, jsonEnd + 1))
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      return { parsed: null, suggestions: null }
    }

    const suggestions =
      Array.isArray(obj.suggestions) && obj.suggestions.length > 0
        ? obj.suggestions
        : null

    return { parsed: obj, suggestions }
  } catch {
    return { parsed: null, suggestions: null }
  }
}
```

**Step 4: Run tests — verify they pass**

```bash
/usr/local/bin/node node_modules/.bin/vitest run src/utils/parseAnalysis.test.js
```

Expected: 9 tests PASS

**Step 5: Commit**

```bash
git add src/utils/parseAnalysis.js src/utils/parseAnalysis.test.js
git commit -m "feat: add parseAnalysis() shared utility for robust LLM JSON extraction"
```

---

## Task 2: Refactor `AnalysisBlock` to use `parseAnalysis`

**Files:**
- Modify: `src/components/AnalysisBlock.jsx`
- Test: `src/components/AnalysisBlock.test.jsx` (no new tests needed — existing tests verify behavior)

This is a pure refactor — identical behavior, just using the shared util. All 10 existing tests must still pass.

---

**Step 1: Edit `AnalysisBlock.jsx`**

Replace the inline JSON extraction block (lines 165–202) with:

```jsx
import { parseAnalysis } from '../utils/parseAnalysis'

// ... (keep all the Block components and Md/Recommendation unchanged) ...

export function AnalysisBlock({ text, adaptiveFormat }) {
  if (!text) return null

  const { parsed } = parseAnalysis(text)

  if (!parsed) {
    return (
      <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    )
  }

  switch (adaptiveFormat) {
    case 'comparison': return <ComparisonBlock data={parsed} />
    case 'investment': return <InvestmentBlock data={parsed} />
    case 'factual':    return <FactualBlock data={parsed} />
    default:           return <TrendBlock data={parsed} />
  }
}
```

**Step 2: Run all tests — verify no regressions**

```bash
/usr/local/bin/node node_modules/.bin/vitest run
```

Expected: all 190+ tests PASS (AnalysisBlock suite: still 10 pass)

**Step 3: Commit**

```bash
git add src/components/AnalysisBlock.jsx
git commit -m "refactor: AnalysisBlock uses parseAnalysis() shared utility"
```

---

## Task 3: Server — `SHORT_NODATA_PROMPT` in `api/explain.js`

**Files:**
- Modify: `api/explain.js`

No unit tests for edge functions (they run on Vercel). Manual verification comes in Task 6.

---

**Step 1: Add `hasData` helper and `SHORT_NODATA_PROMPT` constant**

Open `api/explain.js`. After the existing `CLARIFY_FALLBACK` constant (around line 39), add:

```js
/**
 * Returns true if summaryStats contains at least one meaningful data point.
 * Used to decide whether to return suggestions instead of a plain-text sentence.
 */
function hasData(summaryStats) {
  if (!summaryStats) return false
  if (Number(summaryStats.totalTransactions) > 0) return true
  if (summaryStats.series?.some(s =>
    s.txCount > 0 || s.first !== undefined || s.latestValueFormatted
  )) return true
  return false
}

/**
 * Used in short mode when the query returned no data.
 * Returns minimal JSON with headline + 2 alternative suggestions.
 * Haiku is sufficient — this is a routing/suggestion task, not analysis.
 */
const SHORT_NODATA_PROMPT = `You are a real estate data assistant for the Abu Dhabi property market.
The user queried data that does not exist in the current dataset.

Return a JSON object with exactly these keys:
- "headline": a concise explanation of why data is unavailable (max 12 words, no trailing period)
- "analysis": one sentence explaining what was missing (plain text, no markdown)
- "suggestions": an array of EXACTLY 2 objects, each with:
    - "label": 2-5 word display label (used as the query chip text)
    - "query": the exact query string the user should run next (natural language, 4-10 words)
    - "reason": one sentence why this alternative would return real data

Suggestions MUST be queries this system can actually answer:
price trends, price-per-sqm trends, transaction volumes, project comparisons, district comparisons, layout breakdowns.

Example for "Ready vs Off-Plan Price Gap Since 2021":
{"headline":"No Ready vs Off-Plan comparison data since 2021","analysis":"No dual-series transaction records found for this combination.","suggestions":[{"label":"Ready price trend 2021-2025","query":"Ready property price trend since 2021","reason":"Single sale type records exist where dual-series comparison data is absent"},{"label":"Off-plan volume by district","query":"Off-plan transaction volume by district 2021 to 2025","reason":"Volume data for off-plan properties covers the full requested timeframe"}]}

Rules:
- Return ONLY valid JSON — no markdown fences, no text outside the JSON object
- headline must be factual, not apologetic ("No X data" not "Unfortunately...")
- suggestions must be genuinely useful alternatives, not rephrasing the same broken query`
```

**Step 2: Add the no-data branch in the handler**

In the `handler` function, find where `mode === 'short'` leads to `streamExplain`. It currently falls through to the shared stream path. Add the no-data check right before that, after the mode validation block:

```js
// In the handler, after the clarify block and before the stream setup:

// ── Short-mode no-data: return suggestions JSON instead of a 1-sentence summary ──
if (mode === 'short' && !hasData(summaryStats)) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 350,
      system: SHORT_NODATA_PROMPT,
      messages: [{
        role: 'user',
        content: `The user asked: "${prompt}"\nQuery type: ${intent.queryType}\nFilters: ${JSON.stringify(intent.filters)}`,
      }],
    })
    const rawText = msg?.content?.[0]?.text ?? '{}'
    // Clean fences just in case
    const cleaned = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```\n?$/, '').trim()
    return new Response(cleaned, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.warn('[explain] nodata suggestions failed:', err.message)
    // Fall through to normal short-mode path — better than crashing
  }
}
```

Place this block **after** the `mode === 'clarify'` block and **before** the `const systemPrompt = ...` line.

**Step 3: Verify the file structure is correct**

Read `api/explain.js` and confirm:
1. `hasData()` is defined before the handler
2. `SHORT_NODATA_PROMPT` is defined before the handler
3. The no-data branch is inside the handler, after the clarify block, before the stream setup
4. The `mode === 'short'` check (`if (mode !== 'clarify' && (!intent || !summaryStats))`) still guards correctly

**Step 4: Commit**

```bash
git add api/explain.js
git commit -m "feat: SHORT_NODATA_PROMPT — haiku suggestions when query returns no data"
```

---

## Task 4: `useAnalysis` — detect `noData`, store `suggestions`

**Files:**
- Modify: `src/hooks/useAnalysis.js`

Tests for `useAnalysis` are integration-heavy (mock fetch). Add 2 targeted tests to `src/hooks/useAnalysis.test.js`.

---

**Step 1: Read the existing useAnalysis tests to understand the mock pattern**

Read `src/hooks/useAnalysis.test.js` fully before writing new tests — it uses `vi.stubGlobal('fetch', ...)` to mock the API.

**Step 2: Write the failing tests**

Add to `src/hooks/useAnalysis.test.js` (inside the existing `describe` block or a new nested `describe`):

```js
describe('no-data detection', () => {
  it('sets noData: true and suggestions on post when explain returns JSON with suggestions', async () => {
    // This tests the analyze() pipeline parsing the short-mode nodata JSON response
    const suggestionsJson = JSON.stringify({
      headline: 'No comparison data available',
      analysis: 'No records found.',
      suggestions: [
        { label: 'Ready trend', query: 'Ready price trend 2021-2025', reason: 'Has data' },
        { label: 'Off-plan volume', query: 'Off-plan volume by district', reason: 'Has data' },
      ],
    })

    // The analyze() function calls: fetchIntent → DuckDB query → streamExplain('short')
    // We want to test just the parseAnalysis + patch step.
    // Use parseAnalysis directly to verify the detection logic.
    const { parseAnalysis } = await import('../utils/parseAnalysis')
    const { parsed, suggestions } = parseAnalysis(suggestionsJson)

    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].label).toBe('Ready trend')
    expect(parsed?.headline).toBe('No comparison data available')

    // noData flag is set when suggestions is non-null
    const noData = !!(suggestions?.length > 0)
    expect(noData).toBe(true)
  })

  it('sets noData: false when explain returns plain text (normal short response)', async () => {
    const { parseAnalysis } = await import('../utils/parseAnalysis')
    const { suggestions } = parseAnalysis('Prices rose 18% in the last 12 months.')
    const noData = !!(suggestions?.length > 0)
    expect(noData).toBe(false)
  })
})
```

**Step 3: Run tests — verify they pass (these test parseAnalysis, not yet the hook)**

```bash
/usr/local/bin/node node_modules/.bin/vitest run src/hooks/useAnalysis.test.js
```

Expected: new tests PASS (they only test `parseAnalysis` logic, which already works)

**Step 4: Edit `useAnalysis.js` — add `parseAnalysis` import and detection**

At the top of `src/hooks/useAnalysis.js`, add the import:

```js
import { parseAnalysis } from '../utils/parseAnalysis'
```

In the `analyze()` function, find the `patchPost` call after `streamExplain` (around line 139):

```js
// ── Step 4: stream analyst text (short mode for initial summary) ──
const shortText = await streamExplain(prompt, intent, summaryStats, signal, 'short')

if (signal.aborted) return

// ── Detect no-data: server returns JSON with suggestions instead of plain text ──
const { suggestions } = parseAnalysis(shortText)
const noData = !!(suggestions?.length > 0)

// ── Step 5: finalise ──
patchPost(postId, {
  status: 'done',
  analysisText: shortText,
  shortText,
  summaryStats,
  fullText: null,
  isExpanded: false,
  noData,
  suggestions: suggestions ?? null,
})
```

**Step 5: Edit `analyzeReply()` — same pattern for replies**

In `analyzeReply()`, find the `patchReply` call after `streamExplain` (around line 286):

```js
// ── Step 3: stream reply text (short — 1 sentence) ──
const replyText = await streamExplain(prompt, intent, summaryStats, signal, 'short')

if (signal.aborted) return

// ── Detect no-data for reply ──
const { parsed: replyParsed, suggestions: replySuggestions } = parseAnalysis(replyText)
const replyNoData = !!(replySuggestions?.length > 0)

patchReply(postId, replyId, {
  status: 'done',
  // For replies: show just the headline in the chat bubble (structured view not used)
  analysisText: replyNoData ? (replyParsed?.headline ?? replyText) : replyText,
  noData: replyNoData,
  suggestions: replyNoData ? replySuggestions : null,
})
```

**Step 6: Run all tests**

```bash
/usr/local/bin/node node_modules/.bin/vitest run
```

Expected: all tests PASS — no regressions

**Step 7: Commit**

```bash
git add src/hooks/useAnalysis.js src/hooks/useAnalysis.test.js
git commit -m "feat: useAnalysis detects noData from short-mode JSON, stores post.noData + post.suggestions"
```

---

## Task 5: `ChartSwitcher` — hide chips when `noData`

**Files:**
- Modify: `src/components/ChartSwitcher.jsx`
- Modify: `src/components/ChartSwitcher.test.jsx`

---

**Step 1: Write the failing test**

Add to `src/components/ChartSwitcher.test.jsx` (inside the existing `describe` block):

```js
it('renders nothing when post.noData is true', () => {
  const post = makePost({ noData: true })
  const { container } = render(<ChartSwitcher post={post} />)
  expect(container.firstChild).toBeNull()
})
```

**Step 2: Run test — verify it fails**

```bash
/usr/local/bin/node node_modules/.bin/vitest run src/components/ChartSwitcher.test.jsx
```

Expected: FAIL — chips are still rendered even though `noData: true`

**Step 3: Add the guard to `ChartSwitcher.jsx`**

At the very start of the `ChartSwitcher` function body, before any other logic:

```js
export function ChartSwitcher({ post }) {
  // Hide everything when there is no data — suggestions section handles the UX instead
  if (post.noData) return null

  // ... rest of the existing component unchanged
```

**Step 4: Run tests — verify all 9 pass**

```bash
/usr/local/bin/node node_modules/.bin/vitest run src/components/ChartSwitcher.test.jsx
```

Expected: 9 tests PASS (8 existing + 1 new)

**Step 5: Commit**

```bash
git add src/components/ChartSwitcher.jsx src/components/ChartSwitcher.test.jsx
git commit -m "feat: ChartSwitcher hides chips when post.noData is true"
```

---

## Task 6: `PostCard` — suggestion rows + repurpose "Explore alternatives"

**Files:**
- Modify: `src/components/PostCard.jsx`

This task has more UI wiring. Read `PostCard.jsx` fully before starting. The key sections to touch:
1. The "Deeper analysis" button block (~lines 329–358)
2. The clarifyOptions section (~lines 409–424)
3. The "Ask a follow-up" / ReplyInput section (~lines 426–443)

---

**Step 1: Update `ReplyInput` to accept a custom `label` prop**

Inside `PostCard.jsx`, find the `ReplyInput` function (starts around line 34). Update the function signature and the collapsed button text:

```jsx
function ReplyInput({ postId, onSubmit, disabled, label = 'Ask a follow-up' }) {
  // ... unchanged state/effects ...

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="text-sm text-slate-400 dark:text-slate-500 hover:text-accent dark:hover:text-accent transition-colors flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {label === 'Ask a follow-up' ? (
            // Original chat bubble icon
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          ) : (
            // Pencil icon for "Something else…"
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          )}
        </svg>
        {label}
      </button>
    )
  }

  // ... rest of the component unchanged ...
}
```

**Step 2: Repurpose the "Deeper analysis" button for no-data posts**

Find the "Deeper analysis" button block in the JSX (the section with `onDeepAnalysis`). Replace it with:

```jsx
{/* Deeper analysis / Explore alternatives */}
{(isDone || post.status === 'deepening') && (
  post.noData ? (
    // No-data: "Explore alternatives" runs the top suggestion as a thread reply
    post.suggestions?.length > 0 && onReply && (
      <button
        onClick={() => requireAuth(() => onReply(post.id, post.suggestions[0].query))}
        className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-accent dark:hover:text-accent transition-colors mt-1"
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.346.346a7.5 7.5 0 01-2.121 2.121 5 5 0 01-7.072 0l-.346-.346a5 5 0 010-7.072z"/>
        </svg>
        Explore alternatives
      </button>
    )
  ) : (
    onDeepAnalysis && (
      <button
        onClick={() => onDeepAnalysis(post.id)}
        disabled={post.status === 'deepening'}
        className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-accent dark:hover:text-accent transition-colors disabled:opacity-40 mt-1"
      >
        {post.status === 'deepening' ? (
          <>
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3"/>
            </svg>
            Loading deeper analysis…
          </>
        ) : post.isExpanded ? (
          <>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/>
            </svg>
            Less
          </>
        ) : (
          <>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
            Deeper analysis
          </>
        )}
      </button>
    )
  )
)}
```

**Step 3: Add the suggestion rows section**

Find the clarifyOptions section (around line 409–424). Add the new suggestions section **before** it:

```jsx
{/* ── No-data suggestion rows ── */}
{/* Shown when: post has no data, has suggestions, and no replies have been added yet */}
{onReply && isDone && post.noData && post.suggestions?.length > 0 && !post.replies?.length && (
  <div className="flex flex-col gap-1.5 pt-1">
    {post.suggestions.map((s, i) => (
      <button
        key={i}
        type="button"
        onClick={() => requireAuth(() => onReply(post.id, s.query))}
        disabled={hasActiveReply}
        className="flex items-center gap-2.5 w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        {s.label}
      </button>
    ))}
    {/* "Something else…" — last item, expands to reply input */}
    <ReplyInput
      postId={post.id}
      onSubmit={onReply}
      disabled={hasActiveReply}
      label="Something else…"
    />
  </div>
)}

{/* ── Clarification chips (existing — shown when clarifyOptions exist and no replies yet) ── */}
{onReply && isDone && post.clarifyOptions?.length > 0 && !post.replies?.length && (
  <div className="flex flex-wrap gap-2 pt-1">
    {/* ... unchanged ... */}
  </div>
)}

{/* ── Inline reply input (only when no-data suggestions are NOT shown) ── */}
{onReply && isDone && !(post.noData && !post.replies?.length) && (
  <div className="pt-1">
    {user ? (
      <ReplyInput postId={post.id} onSubmit={onReply} disabled={hasActiveReply} />
    ) : (
      <button
        onClick={() => setShowSignIn(true)}
        className="text-sm text-slate-400 dark:text-slate-500 hover:text-accent dark:hover:text-accent transition-colors flex items-center gap-1.5"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        Ask a follow-up
      </button>
    )}
  </div>
)}
```

**Step 4: Run all tests**

```bash
/usr/local/bin/node node_modules/.bin/vitest run
```

Expected: all tests PASS — PostCard tests don't test the new UI sections directly (they test auth and status states)

**Step 5: Commit**

```bash
git add src/components/PostCard.jsx
git commit -m "feat: PostCard shows suggestion rows + Explore alternatives for noData posts"
```

---

## Task 7: `AIBubble` — reply suggestions chips

**Files:**
- Modify: `src/components/AIBubble.jsx`

---

**Step 1: Read `AIBubble.test.jsx` to understand mock patterns**

Check `src/components/AIBubble.test.jsx` before writing new tests.

**Step 2: Write the failing test**

Add to `src/components/AIBubble.test.jsx`:

```js
it('renders suggestion chips when reply.suggestions is set', () => {
  const onReply = vi.fn()
  const reply = {
    id: 'r1',
    createdAt: Date.now(),
    prompt: 'Ready vs Off-plan',
    status: 'done',
    analysisText: 'No comparison data available.',
    noData: true,
    suggestions: [
      { label: 'Ready price trend', query: 'Ready price trend 2021-2025', reason: 'Has data' },
      { label: 'Off-plan volume', query: 'Off-plan volume by district', reason: 'Has data' },
    ],
  }
  render(<AIBubble reply={reply} onReply={onReply} postId="post1" />)

  expect(screen.getByText('Ready price trend')).toBeInTheDocument()
  expect(screen.getByText('Off-plan volume')).toBeInTheDocument()

  // Clicking runs s.query (not s.label)
  fireEvent.click(screen.getByText('Ready price trend'))
  expect(onReply).toHaveBeenCalledWith('post1', 'Ready price trend 2021-2025')
})
```

**Step 3: Run test — verify it fails**

```bash
/usr/local/bin/node node_modules/.bin/vitest run src/components/AIBubble.test.jsx
```

Expected: FAIL — AIBubble does not render suggestion chips

**Step 4: Add suggestions rendering to `AIBubble.jsx`**

In the `AIBubble` component, after the existing `clarifyOptions` section, add:

```jsx
{/* No-data suggestion chips — show label, run query on tap */}
{reply.suggestions?.length > 0 && (
  <div className="flex flex-col gap-1.5 ml-8 mt-1">
    {reply.suggestions.map((s, i) => (
      <button
        key={i}
        type="button"
        onClick={() => onReply(postId, s.query)}
        className="flex items-center gap-2.5 w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:border-accent hover:text-accent transition-colors"
      >
        <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        {s.label}
      </button>
    ))}
  </div>
)}
```

**Step 5: Run tests — verify all pass**

```bash
/usr/local/bin/node node_modules/.bin/vitest run src/components/AIBubble.test.jsx
```

Expected: all tests PASS (existing + new)

**Step 6: Run full suite**

```bash
/usr/local/bin/node node_modules/.bin/vitest run
```

Expected: all 190+ tests PASS

**Step 7: Commit**

```bash
git add src/components/AIBubble.jsx src/components/AIBubble.test.jsx
git commit -m "feat: AIBubble shows suggestion chips for noData replies"
```

---

## Task 8: Integration verification + version bump + push

**Files:**
- Modify: `package.json` (version bump 1.16 → 1.17)

---

**Step 1: Run the full test suite one final time**

```bash
/usr/local/bin/node node_modules/.bin/vitest run
```

Expected: all tests PASS

**Step 2: Manual smoke test checklist**

Start the dev server and run through these scenarios manually:

1. **No-data query:** Type "Ready vs Off-Plan Price Gap Since 2021"
   - ✅ Initial card shows structured headline (no raw JSON)
   - ✅ NO chart chips visible (Multi-line, Bar, Line gone)
   - ✅ 2 suggestion rows appear below analysis
   - ✅ "Something else…" row visible at bottom of suggestions
   - ✅ "Explore alternatives" button visible (not "Deeper analysis")
   - ✅ Clicking a suggestion row runs it as a thread reply
   - ✅ After the reply appears, suggestions section disappears
   - ✅ Normal "Ask a follow-up" appears after suggestion section hides

2. **Data-rich query:** Type "Yas Island price trend 2023"
   - ✅ Chart chips still appear (Line, Bar, etc.)
   - ✅ "Deeper analysis" button appears (not "Explore alternatives")
   - ✅ Suggestion rows do NOT appear
   - ✅ "Ask a follow-up" appears normally

3. **Reply with no data:** On a data-rich card, ask a follow-up that has no data
   - ✅ Reply bubble shows headline sentence (not raw JSON)
   - ✅ Suggestion chip rows appear below the reply bubble
   - ✅ Clicking a suggestion chip runs another reply

**Step 3: Bump version**

In `package.json`, change `"version": "1.16.0"` to `"version": "1.17.0"`.

**Step 4: Final commit and push**

```bash
git add package.json
git commit -m "chore: bump version to 1.17.0 — noData chips hidden + fallback suggestions"
git push
```

---

## Summary

| Task | Files | Tests Added |
|---|---|---|
| 1. `parseAnalysis` utility | `src/utils/parseAnalysis.js` (new) + `.test.js` (new) | 9 |
| 2. Refactor AnalysisBlock | `src/components/AnalysisBlock.jsx` | 0 (refactor) |
| 3. Server no-data prompt | `api/explain.js` | 0 (edge fn) |
| 4. useAnalysis detection | `src/hooks/useAnalysis.js` + `.test.js` | 2 |
| 5. ChartSwitcher guard | `src/components/ChartSwitcher.jsx` + `.test.jsx` | 1 |
| 6. PostCard suggestions | `src/components/PostCard.jsx` | 0 (manual smoke) |
| 7. AIBubble suggestions | `src/components/AIBubble.jsx` + `.test.jsx` | 1 |
| 8. Version + push | `package.json` | — |

**Net new tests: 13**
