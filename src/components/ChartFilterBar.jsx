import { useState } from 'react'

/**
 * Collapsible filter bar for the Chart tab.
 * Collapsed by default — shows a "Filters" pill.
 * Expands to show: date range, district, project, property type, layout.
 *
 * filters: from useChartFilters
 * updateFilter: (key, value) => void
 * meta: { districts, projects, layouts, propertyTypes } — available options
 */
export function ChartFilterBar({ filters, updateFilter, meta }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4">
      {/* Toggle pill */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:border-accent hover:text-accent transition-colors shadow-sm"
      >
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
        Filters
        {hasActiveFilters(filters) && (
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-accent" />
        )}
      </button>

      {/* Expanded filter panel */}
      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

            {/* Date range */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Date range</label>
              <div className="flex flex-col gap-1">
                <input
                  type="month"
                  value={filters.dateFrom}
                  onChange={e => updateFilter('dateFrom', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-accent"
                />
                <input
                  type="month"
                  value={filters.dateTo}
                  onChange={e => updateFilter('dateTo', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* District */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">District</label>
              <MultiSelect
                options={meta?.districts ?? []}
                value={filters.districts}
                onChange={v => updateFilter('districts', v)}
              />
            </div>

            {/* Project */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Project</label>
              <SearchableSelect
                options={meta?.projects ?? []}
                value={filters.projects[0] ?? ''}
                onChange={v => updateFilter('projects', v ? [v] : [])}
                placeholder="All projects"
              />
            </div>

            {/* Property type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Property type</label>
              <MultiSelect
                options={meta?.propertyTypes ?? []}
                value={filters.propertyTypes}
                onChange={v => updateFilter('propertyTypes', v)}
              />
            </div>

            {/* Layout */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Layout</label>
              <MultiSelect
                options={meta?.layouts ?? []}
                value={filters.layouts}
                onChange={v => updateFilter('layouts', v)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function hasActiveFilters(f) {
  return !!(f.districts?.length || f.projects?.length || f.propertyTypes?.length || f.layouts?.length)
}

/** Minimal multi-select using a native <select multiple> */
function MultiSelect({ options, value, onChange }) {
  return (
    <select
      multiple
      value={value}
      onChange={e => onChange([...e.target.selectedOptions].map(o => o.value))}
      size={4}
      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-accent"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

/** Searchable single-select using datalist */
function SearchableSelect({ options, value, onChange, placeholder }) {
  return (
    <>
      <input
        list="project-list"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-accent"
      />
      <datalist id="project-list">
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
    </>
  )
}
