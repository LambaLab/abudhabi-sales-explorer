import {
  buildMonthlyPriceQuery,
  buildPricePerSqmQuery,
  buildVolumeQuery,
  buildProjectComparisonQuery,
  buildDistrictComparisonQuery,
  buildLayoutComparisonQuery,
} from './queries.js'

const SERIES_KEY = {
  project_comparison:  'project_name',
  district_comparison: 'district',
  layout_distribution: 'layout',
}

/**
 * Convert Claude's structured intent into a DuckDB { sql, params } pair.
 */
export function intentToQuery(intent) {
  const { queryType, filters = {} } = intent
  const { projects = [], districts = [], layouts = [], saleTypes = [], dateFrom, dateTo } = filters

  switch (queryType) {
    case 'price_trend':
      return buildMonthlyPriceQuery({ projects, districts, layouts, saleTypes, dateFrom, dateTo })

    case 'rate_trend':
      return buildPricePerSqmQuery({ projects, districts, layouts, saleTypes, dateFrom, dateTo })

    case 'volume_trend':
      return buildVolumeQuery({ projects, districts, layouts, saleTypes, dateFrom, dateTo })

    case 'project_comparison':
      return buildProjectComparisonQuery({ projectNames: projects, dateFrom, dateTo })

    case 'district_comparison':
      return buildDistrictComparisonQuery({ districts, dateFrom, dateTo })

    case 'layout_distribution':
      return buildLayoutComparisonQuery({ layouts, districts, projects, dateFrom, dateTo })

    default:
      return buildMonthlyPriceQuery({ projects, districts, layouts, saleTypes, dateFrom, dateTo })
  }
}

/**
 * Pivot multi-series DuckDB rows into the shape Recharts expects:
 * [{ month, 'SeriesA': value, 'SeriesB': value }]
 *
 * For single-series queryTypes (price_trend, rate_trend, volume_trend)
 * rows are returned unchanged.
 */
export function pivotChartData(rows, intent) {
  const { queryType } = intent

  const pivotKey = SERIES_KEY[queryType]

  if (!pivotKey) return { chartData: rows, chartKeys: [] }

  const byMonth = {}
  const keys = new Set()

  rows.forEach(row => {
    const seriesName = String(row[pivotKey])
    if (!byMonth[row.month]) byMonth[row.month] = { month: row.month }
    byMonth[row.month][seriesName] = Math.round(Number(row.median_price))
    keys.add(seriesName)
  })

  return {
    chartData: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
    chartKeys: [...keys],
  }
}

/**
 * Compute summary statistics from raw DuckDB rows for the Claude /api/explain call.
 */
export function computeSummaryStats(rows, intent) {
  const { queryType } = intent

  if (!rows || rows.length === 0) {
    return { series: [], dateRange: { from: null, to: null } }
  }

  if (queryType === 'volume_trend') {
    const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))
    const counts = sorted.map(r => Number(r.tx_count))
    const peak = counts.length ? Math.max(...counts) : 0
    const peakRow = sorted.find(r => Number(r.tx_count) === peak)
    return {
      totalTransactions: counts.reduce((a, b) => a + b, 0),
      avgMonthly: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
      peakMonth: peakRow?.month,
      peakCount: peak,
      dateRange: { from: sorted[0]?.month, to: sorted[sorted.length - 1]?.month },
    }
  }

  const pivotKey = SERIES_KEY[queryType]

  if (pivotKey) {
    // Multi-series: group rows by series name
    const seriesMap = {}
    rows.forEach(row => {
      const key = String(row[pivotKey])
      if (!seriesMap[key]) seriesMap[key] = []
      seriesMap[key].push({ month: row.month, price: Number(row.median_price), count: Number(row.tx_count) })
    })
    const series = Object.entries(seriesMap).map(([name, points]) => {
      const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month))
      const first = sorted[0]?.price
      const last  = sorted[sorted.length - 1]?.price
      const peak  = Math.max(...sorted.map(p => p.price))
      const peakPoint = sorted.find(p => p.price === peak)
      return {
        name,
        first:     Math.round(first),
        last:      Math.round(last),
        pctChange: first ? Math.round((last - first) / first * 1000) / 10 : 0,
        peak:      Math.round(peak),
        peakMonth: peakPoint?.month,
        txCount:   sorted.reduce((a, b) => a + b.count, 0),
      }
    })
    const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))
    return { series, dateRange: { from: sorted[0]?.month, to: sorted[sorted.length - 1]?.month } }
  }

  // price_trend / rate_trend — single series
  const valueKey = queryType === 'rate_trend' ? 'median_rate' : 'median_price'
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))
  const values = sorted.map(r => Number(r[valueKey])).filter(v => v > 0)
  const first  = values[0]
  const last   = values[values.length - 1]
  const peak   = Math.max(...values)
  const peakRow = sorted.find(r => Number(r[valueKey]) === peak)
  return {
    series: [{
      name:      'All',
      first:     Math.round(first),
      last:      Math.round(last),
      pctChange: first ? Math.round((last - first) / first * 1000) / 10 : 0,
      peak:      Math.round(peak),
      peakMonth: peakRow?.month,
      txCount:   sorted.reduce((a, b) => a + Number(b.tx_count), 0),
    }],
    dateRange: { from: sorted[0]?.month, to: sorted[sorted.length - 1]?.month },
  }
}
