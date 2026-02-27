import { describe, it, expect } from 'vitest'
import { buildWhereClause, buildMonthlyPriceQuery, buildVolumeQuery } from './queries'

describe('buildWhereClause', () => {
  it('returns empty string when no filters', () => {
    const { where, params } = buildWhereClause({})
    expect(where).toBe('')
    expect(params).toEqual([])
  })

  it('adds date range filter', () => {
    const { where, params } = buildWhereClause({
      dateFrom: '2022-01-01',
      dateTo: '2023-12-31',
    })
    expect(where).toContain('sale_date >= ?')
    expect(where).toContain('sale_date <= ?')
    expect(params).toContain('2022-01-01')
    expect(params).toContain('2023-12-31')
  })

  it('adds district filter', () => {
    const { where, params } = buildWhereClause({ districts: ['Al Reem Island', 'Yas Island'] })
    expect(where).toContain('district IN')
    expect(params).toContain('Al Reem Island')
    expect(params).toContain('Yas Island')
  })

  it('adds property type filter', () => {
    const { where, params } = buildWhereClause({ propertyTypes: ['apartment'] })
    expect(where).toContain('property_type IN')
    expect(params).toContain('apartment')
  })

  it('adds price range filter', () => {
    const { where, params } = buildWhereClause({ priceMin: 500000, priceMax: 5000000 })
    expect(where).toContain('price_aed >= ?')
    expect(where).toContain('price_aed <= ?')
    expect(params).toContain(500000)
    expect(params).toContain(5000000)
  })
})

describe('buildMonthlyPriceQuery', () => {
  it('returns a SQL string', () => {
    const { sql } = buildMonthlyPriceQuery({})
    expect(typeof sql).toBe('string')
    expect(sql).toContain('SELECT')
    expect(sql).toContain('FROM sales')
  })

  it('includes WHERE clause when filters provided', () => {
    const { sql } = buildMonthlyPriceQuery({ dateFrom: '2022-01-01', dateTo: '2023-12-31' })
    expect(sql).toContain('WHERE')
  })
})

describe('buildVolumeQuery', () => {
  it('returns a SQL string with COUNT', () => {
    const { sql } = buildVolumeQuery({})
    expect(sql).toContain('COUNT(*)')
  })
})

import { buildDistrictComparisonQuery, buildLayoutComparisonQuery, buildAvgPriceQuery, buildProjectVolumeQuery } from './queries'

describe('buildDistrictComparisonQuery', () => {
  it('returns empty sql when no districts', () => {
    const { sql } = buildDistrictComparisonQuery({ districts: [] })
    expect(sql).toBe('')
  })

  it('returns SQL grouped by district', () => {
    const { sql, params } = buildDistrictComparisonQuery({
      districts: ['Yas Island', 'Al Reem Island'],
      dateFrom: '2024-01',
      dateTo:   '2025-01',
    })
    expect(sql).toContain('district')
    expect(sql).toContain('GROUP BY month, district')
    expect(sql).toContain('MEDIAN(price_aed)')
    expect(params).toContain('Yas Island')
    expect(params).toContain('Al Reem Island')
    expect(params).toContain('2024-01-01')
  })
})

describe('buildLayoutComparisonQuery', () => {
  it('returns empty sql when no layouts', () => {
    const { sql } = buildLayoutComparisonQuery({ layouts: [] })
    expect(sql).toBe('')
  })

  it('returns SQL grouped by layout', () => {
    const { sql, params } = buildLayoutComparisonQuery({
      layouts: ['1 Bedroom', '2 Bedrooms', '3 Bedrooms'],
    })
    expect(sql).toContain('layout')
    expect(sql).toContain('GROUP BY month, layout')
    expect(sql).toContain('MEDIAN(price_aed)')
    expect(params).toContain('1 Bedroom')
  })

  it('accepts optional district and project filters', () => {
    const { sql, params } = buildLayoutComparisonQuery({
      layouts: ['Studio'],
      districts: ['Yas Island'],
    })
    expect(sql).toContain('district IN')
    expect(params).toContain('Yas Island')
    expect(params).toContain('Studio')
  })
})

describe('buildAvgPriceQuery', () => {
  it('returns sql and empty params with no filters', () => {
    const { sql, params } = buildAvgPriceQuery({})
    expect(sql).toContain('AVG(price_aed)')
    expect(sql).toContain('GROUP BY month')
    expect(params).toEqual([])
  })

  it('applies date filter', () => {
    const { sql, params } = buildAvgPriceQuery({ dateFrom: '2023-01', dateTo: '2023-12' })
    expect(params).toContain('2023-01-01')
    expect(params).toContain('2023-12-31')
  })
})

describe('buildProjectVolumeQuery', () => {
  it('returns sql with no filters', () => {
    const { sql, params } = buildProjectVolumeQuery({})
    expect(sql).toContain('COUNT(*)')
    expect(sql).toContain('project_name')
    expect(params).toEqual([])
  })

  it('respects the limit parameter', () => {
    const { sql } = buildProjectVolumeQuery({}, 20)
    expect(sql).toContain('LIMIT 20')
  })
})

describe('buildWhereClause — projects filter', () => {
  it('includes project_name IN clause when projects provided', () => {
    const { where, params } = buildWhereClause({ projects: ['Noya', 'Reem Hills'] })
    expect(where).toContain('project_name IN')
    expect(params).toContain('Noya')
    expect(params).toContain('Reem Hills')
  })

  it('excludes project_name clause when projects is empty', () => {
    const { where, params } = buildWhereClause({ projects: [] })
    expect(where).not.toContain('project_name')
    expect(params).toHaveLength(0)
  })

  it('combines project filter with other filters', () => {
    const { where, params } = buildWhereClause({ projects: ['Noya'], layouts: ['4 Bedroom'] })
    expect(where).toContain('project_name IN')
    expect(where).toContain('layout IN')
    expect(params).toContain('Noya')
    expect(params).toContain('4 Bedroom')
  })
})
