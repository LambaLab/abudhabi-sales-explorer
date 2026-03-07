import { useState } from 'react'
import { DynamicChart }          from './charts/DynamicChart'
import { DateRangePickerPopover } from './DateRangePickerPopover'
import { CHIP_META }             from '../utils/chipToQuery'
import { intentToQuery, pivotChartData } from '../utils/intentToQuery'
import { query }                 from '../utils/db'

/**
 * ChartSwitcher — replaces the static DynamicChart + DateRangePicker block in PostCard.
 *
 * - When intent.chartNeeded === true: auto-shows the primary chart, chips switch between views.
 * - When intent.chartNeeded === false: shows no chart initially; tapping a chip loads one.
 * - Manages its own dateRange state (moved out of PostCard).
 */
export function ChartSwitcher({ post }) {
  const { intent, chartData: initialChartData, chartKeys: initialChartKeys } = post
  const suggestedCharts = intent?.suggestedCharts ?? []
  const chartNeeded     = intent?.chartNeeded !== false

  // null = no chart shown; string = active chip id
  const [activeChip, setActiveChip] = useState(
    chartNeeded ? (intent?.chartType ?? suggestedCharts[0] ?? null) : null
  )
  const [localChartData, setLocalChartData] = useState(null)
  const [localChartKeys, setLocalChartKeys] = useState(null)
  const [chipLoading, setChipLoading]       = useState(false)
  const [dateRange, setDateRange]           = useState({ dateFrom: '', dateTo: '' })

  const chartData = localChartData ?? initialChartData
  const chartKeys = localChartKeys ?? initialChartKeys

  async function handleChipClick(chipId) {
    const meta = CHIP_META[chipId]
    if (!meta) return

    // Toggle: clicking active chip on a chartNeeded:false post collapses the chart
    if (chipId === activeChip && !chartNeeded) {
      setActiveChip(null)
      return
    }

    setActiveChip(chipId)

    if (meta.queryType && meta.queryType !== intent?.queryType) {
      // Different queryType — run a fresh DuckDB query
      setChipLoading(true)
      try {
        const newIntent = { ...intent, queryType: meta.queryType, chartType: meta.chartType }
        const { sql, params } = intentToQuery(newIntent)
        if (sql) {
          const rows = await query(sql, params)
          const { chartData: cd, chartKeys: ck } = pivotChartData(rows, newIntent)
          setLocalChartData(cd)
          setLocalChartKeys(ck)
        }
      } catch (err) {
        console.error('[ChartSwitcher] query error:', err)
      } finally {
        setChipLoading(false)
      }
    } else {
      // Same queryType, different chartType — reset local overrides, use existing data
      setLocalChartData(null)
      setLocalChartKeys(null)
    }
  }

  // Active chartType for DynamicChart
  const activeChartType = activeChip
    ? (CHIP_META[activeChip]?.chartType ?? activeChip)
    : (intent?.chartType ?? 'bar')

  // Client-side date filter
  const filteredChartData = (() => {
    if (!chartData?.length) return chartData
    const { dateFrom, dateTo } = dateRange
    if (!dateFrom && !dateTo) return chartData
    return chartData.filter(row => {
      const m = row.month ?? ''
      if (dateFrom && m < dateFrom) return false
      if (dateTo   && m > dateTo)   return false
      return true
    })
  })()

  const showChart = activeChip !== null && (filteredChartData?.length > 0 || chipLoading)
  const hasChips  = suggestedCharts.length > 0

  if (!showChart && !hasChips) return null

  return (
    <div className="mt-2 space-y-2">
      {/* Chart area */}
      {showChart && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <DateRangePickerPopover value={dateRange} onChange={setDateRange} align="right" />
          </div>
          {chipLoading ? (
            <div className="h-56 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/30">
              <svg className="h-5 w-5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : (
            <DynamicChart
              intent={{ ...intent, chartType: activeChartType }}
              chartData={filteredChartData}
              chartKeys={chartKeys}
              chartType={activeChartType}
            />
          )}
        </div>
      )}

      {/* Chip row */}
      {hasChips && (
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-0.5">
          {suggestedCharts.map(chipId => {
            const meta = CHIP_META[chipId]
            if (!meta) return null
            const isActive = activeChip === chipId
            return (
              <button
                key={chipId}
                type="button"
                onClick={() => handleChipClick(chipId)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-accent bg-accent text-white'
                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-accent hover:text-accent'
                }`}
              >
                {meta.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
