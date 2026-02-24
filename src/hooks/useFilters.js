import { useState, useCallback } from 'react'

export function useFilters() {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    districts: [],
    propertyTypes: [],
    layouts: [],
    saleTypes: [],      // [] = all
    saleSequences: [],  // [] = all
    priceMin: null,
    priceMax: null,
  })

  const update = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(() => {
    setFilters({
      dateFrom: '', dateTo: '',
      districts: [], propertyTypes: [], layouts: [],
      saleTypes: [], saleSequences: [],
      priceMin: null, priceMax: null,
    })
  }, [])

  return { filters, update, reset }
}
