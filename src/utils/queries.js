/**
 * Normalise a date value that may arrive as YYYY-MM (from Claude's intent)
 * into a full YYYY-MM-DD string that DuckDB can parse as a DATE.
 * Full dates (YYYY-MM-DD) are returned unchanged.
 *
 *   normDateStart("2019-01")  → "2019-01-01"   (first day of month)
 *   normDateEnd("2024-02")    → "2024-02-29"   (last day, leap-year aware)
 *   normDateStart("2022-01-01") → "2022-01-01" (pass-through)
 */
function normDateStart(s) {
  if (!s || /^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return `${s}-01`
}
function normDateEnd(s) {
  if (!s || /^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const [y, m] = s.split('-').map(Number)
  // JS Date months are 0-based: new Date(y, m, 0) = last day of the m-th
  // calendar month (day 0 of the next JS month rolls back one day).
  const lastDay = new Date(y, m, 0).getDate()
  return `${s}-${String(lastDay).padStart(2, '0')}`
}

/**
 * Build a parameterised WHERE clause from filter state.
 * Returns { where: string, params: any[] }
 * where = '' if no filters, otherwise 'WHERE ...'
 */
export function buildWhereClause(filters = {}) {
  const conditions = []
  const params = []

  const { dateFrom, dateTo, districts, propertyTypes, layouts, saleTypes, saleSequences, priceMin, priceMax } = filters

  if (dateFrom) { conditions.push('sale_date >= ?'); params.push(normDateStart(dateFrom)) }
  if (dateTo)   { conditions.push('sale_date <= ?'); params.push(normDateEnd(dateTo)) }

  if (districts?.length) {
    conditions.push(`district IN (${districts.map(() => '?').join(',')})`)
    params.push(...districts)
  }

  if (propertyTypes?.length) {
    conditions.push(`property_type IN (${propertyTypes.map(() => '?').join(',')})`)
    params.push(...propertyTypes)
  }

  if (layouts?.length && !layouts.includes('all')) {
    conditions.push(`layout IN (${layouts.map(() => '?').join(',')})`)
    params.push(...layouts)
  }

  if (saleTypes?.length && !saleTypes.includes('all')) {
    conditions.push(`sale_type IN (${saleTypes.map(() => '?').join(',')})`)
    params.push(...saleTypes)
  }

  if (saleSequences?.length && !saleSequences.includes('all')) {
    conditions.push(`sale_sequence IN (${saleSequences.map(() => '?').join(',')})`)
    params.push(...saleSequences)
  }

  if (priceMin != null) { conditions.push('price_aed >= ?'); params.push(priceMin) }
  if (priceMax != null) { conditions.push('price_aed <= ?'); params.push(priceMax) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return { where, params }
}

/**
 * Monthly median price query
 */
export function buildMonthlyPriceQuery(filters = {}) {
  const { where, params } = buildWhereClause(filters)
  const priceFilter = where ? 'AND price_aed > 0' : 'WHERE price_aed > 0'
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')            AS month,
      MEDIAN(price_aed)                        AS median_price,
      CAST(COUNT(*) AS INTEGER)                AS tx_count
    FROM sales
    ${where}
    ${priceFilter}
    GROUP BY month
    ORDER BY month
  `
  return { sql, params }
}

/**
 * Monthly median price-per-sqm query
 */
export function buildPricePerSqmQuery(filters = {}) {
  const { where, params } = buildWhereClause(filters)
  const rateFilter = where ? 'AND rate_per_sqm > 0' : 'WHERE rate_per_sqm > 0'
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')            AS month,
      MEDIAN(rate_per_sqm)                     AS median_rate,
      CAST(COUNT(*) AS INTEGER)                AS tx_count
    FROM sales
    ${where}
    ${rateFilter}
    GROUP BY month
    ORDER BY month
  `
  return { sql, params }
}

/**
 * Monthly transaction volume query
 */
export function buildVolumeQuery(filters = {}) {
  const { where, params } = buildWhereClause(filters)
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')            AS month,
      CAST(COUNT(*) AS INTEGER)                AS tx_count
    FROM sales
    ${where}
    GROUP BY month
    ORDER BY month
  `
  return { sql, params }
}

/**
 * Per-project monthly median price query (for comparison chart)
 * projectNames: string[]
 * dateFrom/dateTo only — ignores other filters intentionally
 */
export function buildProjectComparisonQuery({ projectNames = [], dateFrom, dateTo }) {
  if (!projectNames.length) return { sql: '', params: [] }
  const conditions = []
  const params = []
  if (dateFrom) { conditions.push('sale_date >= ?'); params.push(normDateStart(dateFrom)) }
  if (dateTo)   { conditions.push('sale_date <= ?'); params.push(normDateEnd(dateTo)) }
  conditions.push(`project_name IN (${projectNames.map(() => '?').join(',')})`)
  params.push(...projectNames)
  conditions.push('price_aed > 0')
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')   AS month,
      project_name,
      MEDIAN(price_aed)               AS median_price,
      CAST(COUNT(*) AS INTEGER)       AS tx_count
    FROM sales
    WHERE ${conditions.join(' AND ')}
    GROUP BY month, project_name
    ORDER BY month
  `
  return { sql, params }
}

/**
 * Get all distinct values for filter dropdowns
 */
export const META_QUERY = `
  SELECT
    (SELECT LIST(DISTINCT district ORDER BY district)      FROM sales WHERE district IS NOT NULL)       AS districts,
    (SELECT LIST(DISTINCT property_type ORDER BY property_type) FROM sales WHERE property_type IS NOT NULL) AS property_types,
    (SELECT LIST(DISTINCT layout ORDER BY layout)          FROM sales WHERE layout IS NOT NULL AND layout != 'unclassified') AS layouts,
    (SELECT LIST(DISTINCT project_name ORDER BY project_name) FROM sales WHERE project_name IS NOT NULL) AS projects,
    MIN(sale_date)  AS min_date,
    MAX(sale_date)  AS max_date,
    MIN(price_aed)  AS min_price,
    MAX(price_aed)  AS max_price
  FROM sales
  WHERE price_aed > 0
`

/**
 * Monthly median price grouped by district (for district comparison chart)
 */
export function buildDistrictComparisonQuery({ districts = [], dateFrom, dateTo }) {
  if (!districts.length) return { sql: '', params: [] }
  const conditions = []
  const params = []
  if (dateFrom) { conditions.push('sale_date >= ?'); params.push(normDateStart(dateFrom)) }
  if (dateTo)   { conditions.push('sale_date <= ?'); params.push(normDateEnd(dateTo)) }
  conditions.push(`district IN (${districts.map(() => '?').join(',')})`)
  params.push(...districts)
  conditions.push('price_aed > 0')
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')   AS month,
      district,
      MEDIAN(price_aed)               AS median_price,
      CAST(COUNT(*) AS INTEGER)       AS tx_count
    FROM sales
    WHERE ${conditions.join(' AND ')}
    GROUP BY month, district
    ORDER BY month
  `
  return { sql, params }
}

/**
 * Monthly median price grouped by layout (for layout comparison chart)
 * Optional district/project filters to scope the data
 */
export function buildLayoutComparisonQuery({ layouts = [], districts = [], projects = [], dateFrom, dateTo }) {
  if (!layouts.length) return { sql: '', params: [] }
  const conditions = []
  const params = []
  if (dateFrom) { conditions.push('sale_date >= ?'); params.push(normDateStart(dateFrom)) }
  if (dateTo)   { conditions.push('sale_date <= ?'); params.push(normDateEnd(dateTo)) }
  if (districts.length) {
    conditions.push(`district IN (${districts.map(() => '?').join(',')})`)
    params.push(...districts)
  }
  if (projects.length) {
    conditions.push(`project_name IN (${projects.map(() => '?').join(',')})`)
    params.push(...projects)
  }
  conditions.push(`layout IN (${layouts.map(() => '?').join(',')})`)
  params.push(...layouts)
  conditions.push('price_aed > 0')
  const sql = `
    SELECT
      strftime(sale_date, '%Y-%m')   AS month,
      layout,
      MEDIAN(price_aed)               AS median_price,
      CAST(COUNT(*) AS INTEGER)       AS tx_count
    FROM sales
    WHERE ${conditions.join(' AND ')}
    GROUP BY month, layout
    ORDER BY month
  `
  return { sql, params }
}
