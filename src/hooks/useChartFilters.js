import { useState, useCallback } from 'react'

/**
 * Global filter state for the Chart tab.
 * Not persisted — resets on page load.
 *
 * Filters shape:
 *   dateFrom: string (YYYY-MM, default = 12 months ago)
 *   dateTo:   string (YYYY-MM, default = current month)
 *   districts: string[]
 *   projects:  string[]
 *   propertyTypes: string[]
 *   layouts:  string[]
 *   saleTypes: string[]
 */
export function useChartFilters(defaultDateRange = '12m') {
  const getDefaultDates = () => {
    const now = new Date()
    const to   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    if (defaultDateRange === 'all') return { dateFrom: '', dateTo: '' }
    const months = defaultDateRange === '24m' ? 24 : 12
    const from = new Date(now.getFullYear(), now.getMonth() - months, 1)
    const dateFrom = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`
    return { dateFrom, dateTo: to }
  }

  const [filters, setFilters] = useState(() => ({
    ...getDefaultDates(),
    districts:     [],
    projects:      [],
    propertyTypes: [],
    layouts:       [],
    saleTypes:     [],
  }))

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resetFilters = useCallback(() => {
    setFilters({ ...getDefaultDates(), districts: [], projects: [], propertyTypes: [], layouts: [], saleTypes: [] })
  }, [defaultDateRange])

  return { filters, updateFilter, resetFilters }
}
