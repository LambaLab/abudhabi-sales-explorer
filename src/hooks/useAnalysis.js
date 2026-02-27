import { useState, useCallback, useRef, useEffect } from 'react'
import { query } from '../utils/db'
import { intentToQuery, pivotChartData, computeSummaryStats } from '../utils/intentToQuery'

async function fetchIntent(prompt, meta, signal, context = null) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, meta, ...(context ? { context } : {}) }),
    signal,
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

async function streamExplain(prompt, intent, summaryStats, signal, mode = 'full') {
  const res = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, intent, summaryStats, mode }),
    signal,
  })
  if (!res.ok) throw new Error(`Explain API error: ${res.status}`)

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel()
        break
      }
      const { done, value } = await reader.read()
      if (done) break
      full += decoder.decode(value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
  return full
}

/**
 * useAnalysis — drives the full analysis pipeline, writing every stage
 * directly into the shared usePostStore via the store functions passed in.
 *
 * @param {object|null} meta  — DuckDB metadata (projects, districts, etc.)
 * @param {object}      store — { addPost, patchPost, addReply, patchReply, getPost }
 */
export function useAnalysis(meta, { addPost, patchPost, addReply, patchReply, getPost }) {
  const [activePostId, setActivePostId] = useState(null)
  const abortRef = useRef(null)
  const mountedRef = useRef(true)

  // Cancel any in-flight request on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  /**
   * Run a new top-level analysis for `prompt`.
   * Creates a post in the store immediately (status: 'analyzing'),
   * then patches it through each pipeline stage — no separate pendingPost.
   */
  const analyze = useCallback(async (prompt) => {
    if (!meta) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    const postId = crypto.randomUUID()
    setActivePostId(postId)

    // ── Step 1: insert placeholder post immediately (fixes the flicker bug) ──
    addPost({
      id:           postId,
      createdAt:    Date.now(),
      prompt,
      title:        prompt.slice(0, 60),
      status:       'analyzing',
      error:        null,
      analysisText: '',
      intent:       null,
      chartData:    null,
      chartKeys:    null,
      replies:      [],
    })

    try {
      // ── Step 2: intent from Claude ──
      const intent = await fetchIntent(prompt, meta, signal)
      patchPost(postId, {
        status: 'querying',
        intent,
        title: intent.title ?? prompt.slice(0, 60),
      })

      // ── Step 3: DuckDB query ──
      const { sql, params } = intentToQuery(intent)
      if (!sql) throw new Error('No SQL generated for this query type')
      const rawRows = await query(sql, params)

      const { chartData, chartKeys } = pivotChartData(rawRows, intent)
      const summaryStats = computeSummaryStats(rawRows, intent)

      patchPost(postId, { status: 'explaining', chartData, chartKeys })

      // ── Step 4: stream analyst text (short mode for initial summary) ──
      const shortText = await streamExplain(prompt, intent, summaryStats, signal, 'short')

      if (signal.aborted) return

      // ── Step 5: finalise ──
      patchPost(postId, {
        status: 'done',
        analysisText: shortText,   // compat alias
        shortText,
        summaryStats,              // stored for analyzeDeep
        fullText: null,
        isExpanded: false,
      })
      if (mountedRef.current) setActivePostId(null)
    } catch (err) {
      if (err.name === 'AbortError') return
      patchPost(postId, { status: 'error', error: err.message ?? 'Something went wrong' })
      if (mountedRef.current) setActivePostId(null)
    }
  }, [meta, addPost, patchPost])

  /**
   * Fetch the full analysis for an already-completed post.
   * If fullText already exists, just toggle isExpanded.
   * Otherwise stream mode:'full' and store the result.
   */
  const analyzeDeep = useCallback(async (postId) => {
    const post = getPost(postId)
    if (!post) return

    // Already fetched — just expand
    if (post.fullText) {
      patchPost(postId, { isExpanded: !post.isExpanded })
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    setActivePostId(postId)
    patchPost(postId, { status: 'deepening' })

    try {
      const fullText = await streamExplain(
        post.prompt,
        post.intent,
        post.summaryStats,
        signal,
        'full'
      )
      if (signal.aborted) return
      patchPost(postId, { status: 'done', fullText, isExpanded: true })
    } catch (err) {
      if (err.name === 'AbortError') return
      patchPost(postId, { status: 'done' }) // revert — short text still visible
    } finally {
      if (mountedRef.current) setActivePostId(null)
    }
  }, [getPost, patchPost])

  /**
   * Run a follow-up analysis inside a post's thread.
   * Passes the parent post's context to Claude so it can decide
   * whether a new chart is needed (chartNeeded: true/false).
   */
  const analyzeReply = useCallback(async (postId, prompt) => {
    if (!meta) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    const replyId = crypto.randomUUID()
    setActivePostId(postId)  // marks this post as "has active work"

    // Build parent context for Claude
    const parent = getPost(postId)
    const context = parent ? {
      parentPrompt:   parent.prompt,
      parentTitle:    parent.title,
      parentAnalysis: (parent.analysisText ?? '').slice(0, 500),
    } : null

    addReply(postId, {
      id:           replyId,
      createdAt:    Date.now(),
      prompt,
      status:       'analyzing',
      error:        null,
      analysisText: '',
      intent:       null,
      chartData:    null,
      chartKeys:    null,
    })

    try {
      // ── Step 1: intent (with parent context) ──
      const intent = await fetchIntent(prompt, meta, signal, context)
      patchReply(postId, replyId, { status: 'querying', intent })

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

      patchReply(postId, replyId, { status: 'explaining', chartData, chartKeys })

      // ── Step 3: stream reply text (buffered — shown all at once) ──
      const fullText = await streamExplain(prompt, intent, summaryStats, signal)

      if (signal.aborted) return

      patchReply(postId, replyId, { status: 'done', analysisText: fullText })
      if (mountedRef.current) setActivePostId(null)
    } catch (err) {
      if (err.name === 'AbortError') {
        // Patch to error rather than leaving the reply frozen at 'explaining'
        patchReply(postId, replyId, { status: 'error', error: 'Interrupted' })
        return
      }
      patchReply(postId, replyId, { status: 'error', error: err.message ?? 'Something went wrong' })
      if (mountedRef.current) setActivePostId(null)
    }
  }, [meta, addReply, patchReply, getPost])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { analyze, analyzeReply, analyzeDeep, activePostId, cancel }
}
