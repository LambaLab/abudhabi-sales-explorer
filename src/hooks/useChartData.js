import { useState, useEffect, useCallback, useRef } from 'react'
import { query } from '../utils/db'

/**
 * Runs a DuckDB query for a single chart widget.
 * Re-runs automatically when `queryFn` or `filters` change.
 *
 * @param {(filters: object) => { sql: string, params: any[] }} queryFn
 * @param {object} filters  — merged global + per-chart override filters
 *
 * Returns { data, loading, error, refetch }
 */
export function useChartData(queryFn, filters) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const abortRef = useRef(null)

  const run = useCallback(async (currentFilters) => {
    const { sql, params } = queryFn(currentFilters)
    if (!sql) return

    abortRef.current?.abort?.()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const rows = await query(sql, params)
      if (!controller.signal.aborted) {
        setData(rows)
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message ?? 'Query failed')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [queryFn])

  // Run on mount + whenever filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    run(filters)
    return () => { abortRef.current?.abort?.() }
  }, [run, JSON.stringify(filters)])

  const refetch = useCallback(() => run(filters), [run, filters])

  return { data, loading, error, refetch }
}
