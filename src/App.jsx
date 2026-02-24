import { useState } from 'react'
import { useDuckDB } from './hooks/useDuckDB'
import { useAppData } from './hooks/useAppData'
import { useFilters } from './hooks/useFilters'
import { useChartData } from './hooks/useChartData'
import { Sidebar } from './components/Sidebar'
import { DateRangePicker } from './components/DateRangePicker'
import { ProjectSearch } from './components/ProjectSearch'
import { MedianPriceChart } from './components/charts/MedianPriceChart'
import { PricePerSqmChart } from './components/charts/PricePerSqmChart'
import { VolumeChart } from './components/charts/VolumeChart'
import { ProjectComparisonChart } from './components/charts/ProjectComparisonChart'

export default function App() {
  const { ready, error: dbError } = useDuckDB()
  const { meta, error: metaError } = useAppData(ready)
  const { filters, update, reset } = useFilters()
  const [selectedProjects, setSelectedProjects] = useState([])
  const { priceData, sqmData, volumeData, comparisonData, loading } = useChartData(filters, selectedProjects, ready)

  const error = dbError || metaError

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-400 text-center">
          <p className="text-xl font-bold mb-2">Failed to load data</p>
          <p className="text-sm opacity-70">{error}</p>
        </div>
      </div>
    )
  }

  if (!ready || !meta) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading {(104848).toLocaleString()}+ records…</p>
        <p className="text-slate-600 text-xs">This takes ~10s on first visit, then it's instant</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-brand border-b border-slate-700 shrink-0 gap-4">
        <h1 className="text-white font-semibold text-lg tracking-tight shrink-0">
          Abu Dhabi Sales Explorer
        </h1>
        <DateRangePicker meta={meta} filters={filters} update={update} />
        {loading && (
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 bg-brand border-r border-slate-700 overflow-y-auto">
          <Sidebar meta={meta} filters={filters} update={update} reset={reset} />
          <div className="px-4 pb-4">
            <ProjectSearch
              projects={meta.projects}
              selected={selectedProjects}
              onChange={setSelectedProjects}
            />
          </div>
        </aside>

        {/* Charts */}
        <main className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Top row: price + sqm side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <MedianPriceChart data={priceData} />
            <PricePerSqmChart data={sqmData} />
          </div>

          {/* Comparison chart — full width */}
          <ProjectComparisonChart data={comparisonData} projects={selectedProjects} />

          {/* Volume — full width */}
          <VolumeChart data={volumeData} />
        </main>
      </div>
    </div>
  )
}
