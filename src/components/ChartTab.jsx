import { useState } from 'react'
import { useChartData }    from '../hooks/useChartData'
import { useChartFilters } from '../hooks/useChartFilters'
import { ChartFilterBar }  from './ChartFilterBar'
import { InlineDateRange } from './charts/InlineDateRange'

import { MedianPriceChart }      from './charts/MedianPriceChart'
import { PricePerSqmChart }      from './charts/PricePerSqmChart'
import { VolumeChart }           from './charts/VolumeChart'
import { HorizontalBarChart }    from './charts/HorizontalBarChart'
import { DonutChart }            from './charts/DonutChart'
import { HistogramChart }        from './charts/HistogramChart'
import { ScatterPlotChart }      from './charts/ScatterPlotChart'
import { OffPlanChart }          from './charts/OffPlanChart'

import {
  buildMonthlyPriceQuery,
  buildAvgPriceQuery,
  buildPricePerSqmQuery,
  buildVolumeQuery,
  buildOffPlanComparisonQuery,
  buildProjectRateQuery,
  buildProjectVolumeQuery,
  buildLayoutMixQuery,
  buildRateDistributionQuery,
  buildPriceDistributionQuery,
  buildSizePriceScatterQuery,
  buildAvgPriceByLayoutQuery,
} from '../utils/queries'

const fmtShort = (v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v)

/**
 * A single chart widget with its own date-range override state.
 * globalFilters come from ChartTab's useChartFilters.
 * localDateRange overrides dateFrom/dateTo for this widget only.
 */
function ChartWidget({ queryFn, globalFilters, renderChart, fullWidth }) {
  const [localDateRange, setLocalDateRange] = useState(null)

  const filters = localDateRange
    ? { ...globalFilters, dateFrom: localDateRange.dateFrom, dateTo: localDateRange.dateTo }
    : globalFilters

  const { data, loading, error, refetch } = useChartData(queryFn, filters)

  const dateRangeValue = localDateRange ?? { dateFrom: globalFilters.dateFrom, dateTo: globalFilters.dateTo }

  if (loading) {
    return (
      <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm ${fullWidth ? 'col-span-full' : ''}`}>
        <div className="h-60 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-red-200 dark:border-red-900/30 bg-white dark:bg-slate-900 p-4 ${fullWidth ? 'col-span-full' : ''}`}>
        <p className="text-xs text-red-500">{error}</p>
        <button onClick={refetch} className="mt-2 text-xs text-accent underline">Retry</button>
      </div>
    )
  }

  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      {renderChart(data, dateRangeValue, setLocalDateRange)}
    </div>
  )
}

/**
 * Chart tab root. Renders 12 curated charts in a 2-column grid.
 */
export function ChartTab({ meta, defaultDateRange }) {
  const { filters, updateFilter, resetFilters } = useChartFilters(defaultDateRange)

  const charts = [
    // 1. Avg Price/SQM Over Time
    {
      queryFn: buildPricePerSqmQuery,
      renderChart: (data, dr, setDr) => (
        <PricePerSqmChart data={data} />
      ),
    },
    // 2. Number of Sales Over Time
    {
      queryFn: buildVolumeQuery,
      renderChart: (data, dr, setDr) => <VolumeChart data={data} />,
    },
    // 3. Avg Sale Price Over Time
    {
      queryFn: buildAvgPriceQuery,
      renderChart: (data, dr, setDr) => (
        <MedianPriceChart
          data={data?.map(d => ({ ...d, median_price: d.avg_price }))}
        />
      ),
    },
    // 4. Off-Plan vs Ready Price/SQM
    {
      queryFn: buildOffPlanComparisonQuery,
      renderChart: (data, dr, setDr) => (
        <OffPlanChart data={data} dateRange={dr} onDateRangeChange={setDr} />
      ),
    },
    // 5. Top Projects by Volume
    {
      queryFn: (f) => buildProjectVolumeQuery(f, 15),
      renderChart: (data, dr, setDr) => (
        <HorizontalBarChart
          title="Top Projects by Volume"
          subtitle="Number of sales"
          data={data?.map(d => ({ label: d.project_name, value: d.tx_count }))}
          dateRange={dr}
          onDateRangeChange={setDr}
        />
      ),
    },
    // 6. Avg Price/SQM by Project
    {
      queryFn: (f) => buildProjectRateQuery(f, 15),
      renderChart: (data, dr, setDr) => (
        <HorizontalBarChart
          title="Avg Price per SQM by Project"
          subtitle="AED/sqm — top 15"
          data={data?.map(d => ({ label: d.project_name, value: d.avg_rate }))}
          valueLabel="AED "
          dateRange={dr}
          onDateRangeChange={setDr}
        />
      ),
    },
    // 7. Sales Volume by Project
    {
      queryFn: (f) => buildProjectVolumeQuery(f, 20),
      renderChart: (data, dr, setDr) => (
        <HorizontalBarChart
          title="Sales Volume by Project"
          subtitle="Transaction count — top 20"
          data={data?.map(d => ({ label: d.project_name, value: d.tx_count }))}
          dateRange={dr}
          onDateRangeChange={setDr}
        />
      ),
    },
    // 8. Avg Sale Price by Layout
    {
      queryFn: buildAvgPriceByLayoutQuery,
      renderChart: (data, dr, setDr) => (
        <HorizontalBarChart
          title="Average Sale Price by Layout"
          subtitle="AED average"
          data={data?.map(d => ({ label: d.layout, value: d.avg_price }))}
          valueLabel="AED "
          dateRange={dr}
          onDateRangeChange={setDr}
        />
      ),
    },
    // 9. Layout Mix donut
    {
      queryFn: buildLayoutMixQuery,
      renderChart: (data, dr, setDr) => (
        <DonutChart
          title="Layout Mix"
          subtitle="Transactions by unit type"
          data={data}
          dateRange={dr}
          onDateRangeChange={setDr}
        />
      ),
    },
    // 10. Price/SQM Distribution histogram
    {
      queryFn: buildRateDistributionQuery,
      renderChart: (data, dr, setDr) => (
        <HistogramChart
          title="Price per SQM Distribution"
          subtitle="AED/sqm frequency"
          data={data}
          bucketLabel={v => `${fmtShort(v)}–${fmtShort(v + 2000)}`}
          dateRange={dr}
          onDateRangeChange={setDr}
        />
      ),
      fullWidth: true,
    },
    // 11. Price Distribution histogram
    {
      queryFn: buildPriceDistributionQuery,
      renderChart: (data, dr, setDr) => (
        <HistogramChart
          title="Price Distribution (Total Price)"
          subtitle="AED total price frequency"
          data={data}
          bucketLabel={v => fmtShort(v)}
          dateRange={dr}
          onDateRangeChange={setDr}
        />
      ),
      fullWidth: true,
    },
    // 12. Size vs Price Scatter
    {
      queryFn: buildSizePriceScatterQuery,
      renderChart: (data, dr, setDr) => (
        <ScatterPlotChart
          title="Size vs Price Scatter"
          subtitle="Area (sqm) vs total sale price"
          data={data}
          dateRange={dr}
          onDateRangeChange={setDr}
        />
      ),
      fullWidth: true,
    },
  ]

  return (
    <div className="px-4 py-4 max-w-6xl mx-auto">
      <ChartFilterBar filters={filters} updateFilter={updateFilter} resetFilters={resetFilters} meta={meta} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map((chart, i) => (
          <ChartWidget
            key={i}
            queryFn={chart.queryFn}
            globalFilters={filters}
            renderChart={chart.renderChart}
            fullWidth={chart.fullWidth}
          />
        ))}
      </div>
    </div>
  )
}
