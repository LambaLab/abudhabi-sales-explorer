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
})
