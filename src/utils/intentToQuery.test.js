import { describe, it, expect } from 'vitest'
import { intentToQuery, pivotChartData, computeSummaryStats } from './intentToQuery'

describe('intentToQuery', () => {
  it('price_trend maps to monthly price query', () => {
    const { sql, params } = intentToQuery({
      queryType: 'price_trend',
      filters: { dateFrom: '2024-01', dateTo: '2025-01', districts: ['Yas Island'] },
    })
    expect(sql).toContain('median_price')
    expect(sql).toContain('GROUP BY month')
    expect(params).toContain('Yas Island')
  })

  it('rate_trend maps to rate-per-sqm query', () => {
    const { sql } = intentToQuery({
      queryType: 'rate_trend',
      filters: {},
    })
    expect(sql).toContain('median_rate')
  })

  it('volume_trend maps to volume query', () => {
    const { sql } = intentToQuery({
      queryType: 'volume_trend',
      filters: {},
    })
    expect(sql).toContain('tx_count')
    expect(sql).not.toContain('median_price')
  })

  it('project_comparison maps to project comparison query', () => {
    const { sql, params } = intentToQuery({
      queryType: 'project_comparison',
      filters: { projects: ['Noya - Phase 1', 'Yas Acres'] },
    })
    expect(sql).toContain('project_name')
    expect(params).toContain('Noya - Phase 1')
  })

  it('district_comparison maps to district comparison query', () => {
    const { sql, params } = intentToQuery({
      queryType: 'district_comparison',
      filters: { districts: ['Yas Island', 'Al Reem Island'] },
    })
    expect(sql).toContain('GROUP BY month, district')
    expect(params).toContain('Yas Island')
  })

  it('layout_distribution maps to layout comparison query', () => {
    const { sql, params } = intentToQuery({
      queryType: 'layout_distribution',
      filters: { layouts: ['1 Bedroom', '2 Bedrooms'], districts: ['Yas Island'] },
    })
    expect(sql).toContain('GROUP BY month, layout')
    expect(params).toContain('1 Bedroom')
  })

  it('falls back to price_trend for unknown queryType', () => {
    const { sql } = intentToQuery({ queryType: 'unknown', filters: {} })
    expect(sql).toContain('median_price')
  })

  it('falls back to price_trend with all filters preserved for unknown queryType', () => {
    const { sql, params } = intentToQuery({ queryType: 'unknown', filters: { districts: ['Yas Island'] } })
    expect(sql).toContain('median_price')
    expect(params).toContain('Yas Island')
  })

  it('works when intent has no filters key at all', () => {
    const { sql } = intentToQuery({ queryType: 'price_trend' })
    expect(sql).toContain('median_price')
  })
})

describe('pivotChartData', () => {
  const projectRows = [
    { month: '2024-01', project_name: 'Noya - Phase 1', median_price: 2000000, tx_count: 10 },
    { month: '2024-01', project_name: 'Yas Acres',       median_price: 1500000, tx_count: 5 },
    { month: '2024-02', project_name: 'Noya - Phase 1', median_price: 2100000, tx_count: 8 },
    { month: '2024-02', project_name: 'Yas Acres',       median_price: 1600000, tx_count: 6 },
  ]

  it('pivots project rows into {month, ProjectA, ProjectB} shape', () => {
    const { chartData, chartKeys } = pivotChartData(projectRows, { queryType: 'project_comparison' })
    expect(chartData).toHaveLength(2)
    expect(chartData[0].month).toBe('2024-01')
    expect(chartData[0]['Noya - Phase 1']).toBe(2000000)
    expect(chartData[0]['Yas Acres']).toBe(1500000)
    expect(chartKeys).toContain('Noya - Phase 1')
    expect(chartKeys).toContain('Yas Acres')
  })

  it('returns flat rows unchanged for price_trend', () => {
    const rows = [{ month: '2024-01', median_price: 2000000, tx_count: 10 }]
    const { chartData, chartKeys } = pivotChartData(rows, { queryType: 'price_trend' })
    expect(chartData).toEqual(rows)
    expect(chartKeys).toEqual([])
  })

  it('pivots district rows using district key', () => {
    const rows = [
      { month: '2024-01', district: 'Yas Island', median_price: 1800000, tx_count: 20 },
      { month: '2024-01', district: 'Al Reem Island', median_price: 2200000, tx_count: 30 },
    ]
    const { chartData } = pivotChartData(rows, { queryType: 'district_comparison' })
    expect(chartData[0]['Yas Island']).toBe(1800000)
    expect(chartData[0]['Al Reem Island']).toBe(2200000)
  })

  it('pivots layout rows using layout key', () => {
    const rows = [
      { month: '2024-01', layout: '1 Bedroom', median_price: 900000, tx_count: 15 },
      { month: '2024-01', layout: '2 Bedrooms', median_price: 1400000, tx_count: 10 },
    ]
    const { chartData, chartKeys } = pivotChartData(rows, { queryType: 'layout_distribution' })
    expect(chartData[0]['1 Bedroom']).toBe(900000)
    expect(chartData[0]['2 Bedrooms']).toBe(1400000)
    expect(chartKeys).toContain('1 Bedroom')
    expect(chartKeys).toContain('2 Bedrooms')
  })
})

describe('computeSummaryStats', () => {
  it('computes pctChange for price_trend', () => {
    const rows = [
      { month: '2024-01', median_price: 2000000, tx_count: 10 },
      { month: '2024-06', median_price: 2400000, tx_count: 12 },
    ]
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series[0].pctChange).toBe(20)
    expect(stats.series[0].first).toBe(2000000)
    expect(stats.series[0].last).toBe(2400000)
  })

  it('computes totalTransactions for volume_trend', () => {
    const rows = [
      { month: '2024-01', tx_count: 100 },
      { month: '2024-02', tx_count: 150 },
    ]
    const stats = computeSummaryStats(rows, { queryType: 'volume_trend' })
    expect(stats.totalTransactions).toBe(250)
    expect(stats.peakCount).toBe(150)
    expect(stats.peakMonth).toBe('2024-02')
  })

  it('computes multi-series stats for project_comparison', () => {
    const rows = [
      { month: '2024-01', project_name: 'Noya - Phase 1', median_price: 2000000, tx_count: 10 },
      { month: '2024-06', project_name: 'Noya - Phase 1', median_price: 2400000, tx_count: 12 },
      { month: '2024-01', project_name: 'Yas Acres', median_price: 1500000, tx_count: 5 },
      { month: '2024-06', project_name: 'Yas Acres', median_price: 1600000, tx_count: 6 },
    ]
    const stats = computeSummaryStats(rows, { queryType: 'project_comparison' })
    expect(stats.series).toHaveLength(2)
    const noya = stats.series.find(s => s.name === 'Noya - Phase 1')
    expect(noya.first).toBe(2000000)
    expect(noya.last).toBe(2400000)
    expect(noya.pctChange).toBe(20)
    expect(stats.dateRange).toBeDefined()
    expect(stats.dateRange.from).toBe('2024-01')
  })

  it('computes single-series stats for rate_trend using median_rate key', () => {
    const rows = [
      { month: '2024-01', median_rate: 10000, tx_count: 20 },
      { month: '2024-06', median_rate: 12000, tx_count: 25 },
    ]
    const stats = computeSummaryStats(rows, { queryType: 'rate_trend' })
    expect(stats.series[0].first).toBe(10000)
    expect(stats.series[0].last).toBe(12000)
    expect(stats.series[0].pctChange).toBe(20)
    expect(stats.dateRange).toBeDefined()
    expect(stats.dateRange.from).toBe('2024-01')
  })

  it('includes dateRange in volume_trend result', () => {
    const rows = [
      { month: '2024-01', tx_count: 100 },
      { month: '2024-02', tx_count: 150 },
      { month: '2024-03', tx_count: 120 },
    ]
    const stats = computeSummaryStats(rows, { queryType: 'volume_trend' })
    expect(stats.dateRange).toBeDefined()
    expect(stats.dateRange.from).toBe('2024-01')
    expect(stats.dateRange.to).toBe('2024-03')
  })

  it('returns empty series for empty rows', () => {
    const stats = computeSummaryStats([], { queryType: 'price_trend' })
    expect(stats.series).toEqual([])
    expect(stats.dateRange).toBeDefined()
  })
})

// Minimal row factory for price_trend
function makeRows(months, startPrice = 1_000_000, step = 50_000) {
  return months.map((m, i) => ({
    month: m,
    median_price: startPrice + i * step,
    median_rate: 8000 + i * 200,
    tx_count: 100 + i * 5,
  }))
}

const MONTHS_24 = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(2022, i, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})

describe('computeSummaryStats — enriched fields', () => {
  it('includes latestValueFormatted as "AED X,XXX,XXX"', () => {
    const rows = makeRows(MONTHS_24)
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series[0].latestValueFormatted).toMatch(/^AED [\d,]+$/)
  })

  it('includes overallChangeFormatted with sign', () => {
    const rows = makeRows(MONTHS_24)
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series[0].overallChangeFormatted).toMatch(/^[+-]\d+\.\d+%$/)
  })

  it('includes rawSeries with all data points', () => {
    const rows = makeRows(MONTHS_24)
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.rawSeries).toHaveLength(24)
    expect(stats.rawSeries[0]).toMatchObject({ month: expect.any(String), value: expect.any(Number), label: expect.any(String) })
  })

  it('includes yoyChangeFormatted when >= 24 months of data', () => {
    const rows = makeRows(MONTHS_24)
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series[0].yoyChangeFormatted).toMatch(/^[+-]\d+\.\d+%$/)
  })

  it('yoyChangeFormatted is null when < 24 months', () => {
    const rows = makeRows(MONTHS_24.slice(0, 12))
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series[0].yoyChangeFormatted).toBeNull()
  })

  it('identifies troughMonth and troughValueFormatted correctly', () => {
    const rows = makeRows(MONTHS_24) // prices increase monotonically, so trough = first
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series[0].troughMonth).toBe(MONTHS_24[0])
    expect(stats.series[0].troughValueFormatted).toMatch(/^AED [\d,]+$/)
  })

  it('includes cagrFormatted for price_trend with 24 months', () => {
    const rows = makeRows(MONTHS_24)
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series[0].cagrFormatted).toMatch(/^[+-]\d+\.\d+% CAGR$/)
  })

  it('includes rawSeries for volume_trend', () => {
    const rows = MONTHS_24.map(m => ({ month: m, tx_count: 200 }))
    const stats = computeSummaryStats(rows, { queryType: 'volume_trend' })
    expect(stats.rawSeries).toHaveLength(24)
    expect(stats.rawSeries[0]).toMatchObject({ month: expect.any(String), value: 200, label: expect.any(String) })
  })

  it('includes per-series enriched fields for multi-series', () => {
    const rows = MONTHS_24.flatMap(m => [
      { month: m, project_name: 'Alpha', median_price: 1_000_000, tx_count: 50 },
      { month: m, project_name: 'Beta',  median_price: 800_000,   tx_count: 30 },
    ])
    const stats = computeSummaryStats(rows, { queryType: 'project_comparison' })
    const alpha = stats.series.find(s => s.name === 'Alpha')
    expect(alpha.latestValueFormatted).toMatch(/^AED/)
    expect(alpha.overallChangeFormatted).toBeDefined()
  })
})

describe('computeSummaryStats — edge cases', () => {
  it('handles empty values array gracefully (all prices are 0)', () => {
    const rows = MONTHS_24.map(m => ({ month: m, median_price: 0, median_rate: 0, tx_count: 10 }))
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series).toHaveLength(0)
    expect(stats.rawSeries).toHaveLength(0)
  })

  it('handles single data point without NaN', () => {
    const rows = [{ month: '2024-01', median_price: 1_500_000, median_rate: 10000, tx_count: 5 }]
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series[0].latestValueFormatted).not.toContain('NaN')
    expect(stats.series[0].overallChangeFormatted).not.toContain('NaN')
    expect(stats.series[0].cagrFormatted).toBeNull() // < 12 months
  })

  it('overallChangeAbsFormatted does not show + sign when change is zero', () => {
    const rows = MONTHS_24.map(m => ({ month: m, median_price: 1_000_000, median_rate: 8000, tx_count: 100 }))
    const stats = computeSummaryStats(rows, { queryType: 'price_trend' })
    expect(stats.series[0].overallChangeAbsFormatted).not.toMatch(/^\+/)
  })

  it('does not crash with large arrays (500 rows)', () => {
    const months = Array.from({ length: 500 }, (_, i) => {
      const d = new Date(1980, i, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    const rows = months.map(m => ({ month: m, median_price: 1_000_000, median_rate: 8000, tx_count: 100 }))
    expect(() => computeSummaryStats(rows, { queryType: 'price_trend' })).not.toThrow()
  })
})
