import { useState, useCallback, useRef, useEffect } from 'react'
import { query } from '../utils/db'
import { intentToQuery, pivotChartData, computeSummaryStats } from '../utils/intentToQuery'
import { usePostStore } from './usePostStore'

function uuid() {
  return crypto.randomUUID()
}

async function fetchIntent(prompt, meta, signal) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, meta }),
    signal,
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

async function streamExplain(prompt, intent, summaryStats, onChunk, signal) {
  const res = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, intent, summaryStats }),
    signal,
  })
  if (!res.ok) throw new Error(`Explain API error: ${res.status}`)

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''

  while (true) {
    if (signal?.aborted) break
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    onChunk(chunk)
  }
  return full
}

export function useAnalysis(meta) {
  const { addPost } = usePostStore()
  const [status, setStatus]   = useState('idle')   // idle | analyzing | querying | explaining | done | error
  const [error, setError]     = useState(null)
  const [pendingPost, setPendingPost] = useState(null)
  const abortRef = useRef(null)

  // Cancel any in-flight request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const analyze = useCallback(async (prompt) => {
    if (!meta) return

    // Cancel any prior in-flight run (double-submit guard)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller

    setStatus('analyzing')
    setError(null)
    setPendingPost(null)

    try {
      // Step 1: Get intent from Claude
      const intent = await fetchIntent(prompt, meta, signal)

      setStatus('querying')

      // Step 2: Run DuckDB query
      const { sql, params } = intentToQuery(intent)
      if (!sql) throw new Error('No SQL generated for this query type')
      const rawRows = await query(sql, params)

      // Step 3: Pivot data for chart + compute summary stats
      const { chartData, chartKeys } = pivotChartData(rawRows, intent)
      const summaryStats = computeSummaryStats(rawRows, intent)

      // Step 4: Stream analyst text from Claude
      setStatus('explaining')
      const postId = uuid()
      // Create a placeholder post that the UI shows while text streams in
      const placeholder = {
        id:           postId,
        createdAt:    Date.now(),
        prompt,
        title:        intent.title ?? prompt.slice(0, 60),
        analysisText: '',
        intent,
        chartData,
        chartKeys,
        isStreaming:  true,
      }
      setPendingPost(placeholder)

      let fullText = ''
      await streamExplain(prompt, intent, summaryStats, (chunk) => {
        fullText += chunk
        setPendingPost(prev => prev ? { ...prev, analysisText: fullText } : prev)
      }, signal)

      // If aborted, don't save the post
      if (signal.aborted) return

      // Step 5: Finalise post
      const finalPost = { ...placeholder, analysisText: fullText, isStreaming: false }
      setPendingPost(null)
      addPost(finalPost)
      setStatus('done')
    } catch (err) {
      // Ignore abort errors — they're expected when user navigates away or re-submits
      if (err.name === 'AbortError') return
      setError(err.message ?? 'Something went wrong')
      setStatus('error')
      setPendingPost(null)
    }
  }, [meta, addPost])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setPendingPost(null)
  }, [])

  return { analyze, status, error, pendingPost, reset }
}
