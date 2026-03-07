import {
  buildMonthlyPriceQuery,
  buildPricePerSqmQuery,
  buildVolumeQuery,
  buildProjectComparisonQuery,
  buildDistrictComparisonQuery,
  buildLayoutComparisonQuery,
} from './queries.js'

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtAED(v) {
  return `AED ${Math.round(v).toLocaleString('en-US')}`
}

function fmtPct(v) {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

function fmtMonth(month) {
  if (!month) return ''
  const [year, m] = month.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[parseInt(m, 10) - 1] ?? m} ${year}`
}

function computeYoY(sorted, valueKey) {
  if (sorted.length < 24) return null
  const last12 = sorted.slice(-12).reduce((a, r) => a + Number(r[valueKey]), 0) / 12
  const prev12 = sorted.slice(-24, -12).reduce((a, r) => a + Number(r[valueKey]), 0) / 12
  if (!prev12) return null
  return Math.round((last12 - prev12) / prev12 * 1000) / 10
}

function computeCAGR(first, last, months) {
  if (!first || months < 12) return null
  return Math.round((Math.pow(last / first, 12 / months) - 1) * 1000) / 10
}

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
 * Compute enriched summary statistics from raw DuckDB rows for the Claude /api/explain call.
 * Returns pre-computed formatted strings so Claude never needs to calculate or format numbers.
 */
export function computeSummaryStats(rows, intent) {
  const { queryType } = intent

  if (!rows || rows.length === 0) {
    return { series: [], rawSeries: [], dateRange: { from: null, to: null } }
  }

  // ── volume_trend ────────────────────────────────────────────────────────
  if (queryType === 'volume_trend') {
    const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))
    const counts  = sorted.map(r => Number(r.tx_count))
    const total   = counts.reduce((a, b) => a + b, 0)
    const avg     = total / counts.length
    const peak    = Math.max(...counts)
    const peakRow = sorted.find(r => Number(r.tx_count) === peak)
    return {
      totalTransactions: total,
      avgMonthly: Math.round(avg),
      peakMonth:  peakRow?.month,
      peakCount:  peak,
      dateRange:  { from: sorted[0]?.month, to: sorted[sorted.length - 1]?.month },
      rawSeries:  sorted.map(r => ({
        month: r.month,
        value: Number(r.tx_count),
        label: fmtMonth(r.month),
      })),
    }
  }

  const pivotKey = SERIES_KEY[queryType]

  // ── multi-series (project_comparison, district_comparison, layout_distribution) ──
  if (pivotKey) {
    const seriesMap = {}
    rows.forEach(row => {
      const key = String(row[pivotKey])
      if (!seriesMap[key]) seriesMap[key] = []
      seriesMap[key].push({
        month: row.month,
        price: Number(row.median_price),
        count: Number(row.tx_count),
      })
    })

    const series = Object.entries(seriesMap).map(([name, points]) => {
      const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month))
      const prices = sorted.map(p => p.price)
      const first  = prices[0]
      const last   = prices[prices.length - 1]
      const peak   = Math.max(...prices)
      const trough = Math.min(...prices)
      const peakPt   = sorted.find(p => p.price === peak)
      const troughPt = sorted.find(p => p.price === trough)
      const months   = sorted.length
      const pctChange = first ? Math.round((last - first) / first * 1000) / 10 : 0
      const absChange = last - first
      const cagr      = computeCAGR(first, last, months)
      return {
        name,
        first:     Math.round(first),
        last:      Math.round(last),
        pctChange,
        peak:      Math.round(peak),
        peakMonth: peakPt?.month,
        txCount:   sorted.reduce((a, b) => a + b.count, 0),
        latestMonth:              sorted[sorted.length - 1]?.month,
        troughValue:              Math.round(trough),
        troughMonth:              troughPt?.month,
        yoyChange:                null,
        cagr,
        latestValueFormatted:     fmtAED(last),
        peakValueFormatted:       fmtAED(peak),
        troughValueFormatted:     fmtAED(trough),
        overallChangeFormatted:   fmtPct(pctChange),
        overallChangeAbsFormatted:(absChange >= 0 ? '+' : '') + fmtAED(Math.abs(absChange)),
        yoyChangeFormatted:       null,
        cagrFormatted:            cagr != null ? `${fmtPct(cagr)} CAGR` : null,
      }
    })

    const allSorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))
    return {
      series,
      rawSeries: [],
      dateRange: { from: allSorted[0]?.month, to: allSorted[allSorted.length - 1]?.month },
    }
  }

  // ── single-series (price_trend / rate_trend) ─────────────────────────────
  const valueKey = queryType === 'rate_trend' ? 'median_rate' : 'median_price'
  const sorted   = [...rows].sort((a, b) => a.month.localeCompare(b.month))
  const values   = sorted.map(r => Number(r[valueKey])).filter(v => v > 0)
  const first    = values[0]
  const last     = values[values.length - 1]
  const peak     = Math.max(...values)
  const trough   = Math.min(...values)
  const peakRow   = sorted.find(r => Number(r[valueKey]) === peak)
  const troughRow = sorted.find(r => Number(r[valueKey]) === trough)
  const months    = sorted.length
  const pctChange = first ? Math.round((last - first) / first * 1000) / 10 : 0
  const absChange = last - first
  const yoyChange = computeYoY(sorted, valueKey)
  const cagr      = computeCAGR(first, last, months)

  return {
    series: [{
      name:      'All',
      first:     Math.round(first),
      last:      Math.round(last),
      pctChange,
      peak:      Math.round(peak),
      peakMonth: peakRow?.month,
      txCount:   sorted.reduce((a, b) => a + Number(b.tx_count), 0),
      latestMonth:              sorted[sorted.length - 1]?.month,
      troughValue:              Math.round(trough),
      troughMonth:              troughRow?.month,
      yoyChange,
      cagr,
      latestValueFormatted:     fmtAED(last),
      peakValueFormatted:       fmtAED(peak),
      troughValueFormatted:     fmtAED(trough),
      overallChangeFormatted:   fmtPct(pctChange),
      overallChangeAbsFormatted:(absChange >= 0 ? '+' : '') + fmtAED(Math.abs(absChange)),
      yoyChangeFormatted:       yoyChange != null ? fmtPct(yoyChange) : null,
      cagrFormatted:            cagr != null ? `${fmtPct(cagr)} CAGR` : null,
    }],
    rawSeries: sorted.map(r => ({
      month: r.month,
      value: Math.round(Number(r[valueKey])),
      label: fmtMonth(r.month),
    })),
    dateRange: { from: sorted[0]?.month, to: sorted[sorted.length - 1]?.month },
  }
}
