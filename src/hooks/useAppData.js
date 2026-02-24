import { useState, useEffect } from 'react'
import { query } from '../utils/db'
import { META_QUERY } from '../utils/queries'

export function useAppData(ready) {
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ready) return
    query(META_QUERY)
      .then(rows => {
        const row = rows[0]
        setMeta({
          districts: Array.from(row.districts ?? []),
          propertyTypes: Array.from(row.property_types ?? []),
          layouts: Array.from(row.layouts ?? []),
          projects: Array.from(row.projects ?? []),
          minDate: row.min_date,
          maxDate: row.max_date,
          minPrice: row.min_price,
          maxPrice: row.max_price,
        })
      })
      .catch(err => setError(err.message))
  }, [ready])

  return { meta, error }
}
