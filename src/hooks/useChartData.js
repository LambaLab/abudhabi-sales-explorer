import { useState, useEffect } from 'react'
import { query } from '../utils/db'
import {
  buildMonthlyPriceQuery,
  buildPricePerSqmQuery,
  buildVolumeQuery,
  buildProjectComparisonQuery,
} from '../utils/queries'

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

export function useChartData(filters, selectedProjects, ready) {
  const [priceData, setPriceData] = useState([])
  const [sqmData, setSqmData] = useState([])
  const [volumeData, setVolumeData] = useState([])
  const [comparisonData, setComparisonData] = useState([])
  const [loading, setLoading] = useState(false)

  const debouncedFilters = useDebounce(filters, 400)
  const debouncedProjects = useDebounce(selectedProjects, 400)

  useEffect(() => {
    if (!ready) return

    let cancelled = false
    setLoading(true)

    const { sql: pSql, params: pParams } = buildMonthlyPriceQuery(debouncedFilters)
    const { sql: sSql, params: sParams } = buildPricePerSqmQuery(debouncedFilters)
    const { sql: vSql, params: vParams } = buildVolumeQuery(debouncedFilters)

    Promise.all([
      query(pSql, pParams),
      query(sSql, sParams),
      query(vSql, vParams),
    ]).then(([price, sqm, volume]) => {
      if (cancelled) return
      setPriceData(price)
      setSqmData(sqm)
      setVolumeData(volume)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [debouncedFilters, ready])

  useEffect(() => {
    if (!ready || !debouncedProjects.length) {
      setComparisonData([])
      return
    }

    const { sql, params } = buildProjectComparisonQuery({
      projectNames: debouncedProjects,
      dateFrom: debouncedFilters.dateFrom,
      dateTo: debouncedFilters.dateTo,
    })

    if (!sql) return

    query(sql, params).then(rows => {
      // Group rows by month, pivot projects as keys
      const byMonth = {}
      rows.forEach(row => {
        if (!byMonth[row.month]) byMonth[row.month] = { month: row.month }
        byMonth[row.month][row.project_name] = Math.round(row.median_price)
      })
      setComparisonData(Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)))
    })
  }, [debouncedProjects, debouncedFilters.dateFrom, debouncedFilters.dateTo, ready])

  return { priceData, sqmData, volumeData, comparisonData, loading }
}
