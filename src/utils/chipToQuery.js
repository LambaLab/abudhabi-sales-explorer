/**
 * Maps chip IDs (from intent.suggestedCharts) to display metadata.
 *
 * queryType: null  → same queryType as parent intent, just change chartType visualization
 * queryType: string → run a new DuckDB query with this queryType
 */
export const CHIP_META = {
  line:        { label: 'Line',        queryType: null,               chartType: 'line' },
  bar:         { label: 'Bar',         queryType: null,               chartType: 'bar' },
  multiline:   { label: 'Multi-line',  queryType: null,               chartType: 'multiline' },
  volume:      { label: 'Volume',      queryType: 'volume_trend',     chartType: 'bar' },
  price_trend: { label: 'Price trend', queryType: 'price_trend',      chartType: 'line' },
  rate_trend:  { label: 'AED/sqm',     queryType: 'rate_trend',       chartType: 'line' },
}
