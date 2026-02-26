import { useState } from 'react'

const DATE_PRESETS = [
  { label: 'Last 12m', key: '12m',  months: 12 },
  { label: 'Last 2y',  key: '24m',  months: 24 },
  { label: 'Last 3y',  key: '36m',  months: 36 },
  { label: 'All time', key: 'all',  months: null },
]

function presetToDates(key) {
  if (key === 'all') return { dateFrom: '', dateTo: '' }
  const months = DATE_PRESETS.find(p => p.key === key)?.months ?? 12
  const now    = new Date()
  const to     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const fromD  = new Date(now.getFullYear(), now.getMonth() - months, 1)
  const from   = `${fromD.getFullYear()}-${String(fromD.getMonth() + 1).padStart(2, '0')}`
  return { dateFrom: from, dateTo: to }
}

const SALE_TYPE_OPTIONS = ['All', 'Ready', 'Off-Plan']

function pillClass(active) {
  return `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 cursor-pointer focus:outline-none transition-colors appearance-none ${
    active
      ? 'border-accent text-accent dark:border-accent'
      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
  }`
}

function hasActiveFilters(filters, datePreset) {
  return (
    datePreset !== 'all' ||
    !!(filters.dateFrom || filters.dateTo ||
       filters.districts?.length  ||
       filters.projects?.length   ||
       filters.propertyTypes?.length ||
       filters.layouts?.length    ||
       filters.saleTypes?.length)
  )
}

/**
 * Always-visible horizontal filter strip for the Charts tab.
 * Horizontally scrollable on small screens.
 */
export function ChartFilterBar({ filters, updateFilter, resetFilters, meta }) {
  const [datePreset, setDatePreset] = useState(() => {
    if (!filters?.dateFrom && !filters?.dateTo) return 'all'
    const now   = new Date()
    const toStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    if (filters.dateTo === toStr || !filters.dateTo) {
      for (const p of DATE_PRESETS.filter(x => x.months)) {
        const { dateFrom } = presetToDates(p.key)
        if (dateFrom === filters.dateFrom) return p.key
      }
    }
    return 'all'
  })

  function handleDatePreset(key) {
    setDatePreset(key)
    const { dateFrom, dateTo } = presetToDates(key)
    updateFilter('dateFrom', dateFrom)
    updateFilter('dateTo', dateTo)
  }

  const activeSaleType = filters.saleTypes?.length === 1 ? filters.saleTypes[0] : 'All'

  function handleSaleType(type) {
    updateFilter('saleTypes', type === 'All' ? [] : [type])
  }

  function handleReset() {
    setDatePreset('all')
    resetFilters()
  }

  const isActive = hasActiveFilters(filters, datePreset)

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">

      {/* Date range preset */}
      <select
        value={datePreset}
        onChange={e => handleDatePreset(e.target.value)}
        className={pillClass(datePreset !== 'all')}
        style={{ backgroundImage: 'none' }}
      >
        {DATE_PRESETS.map(p => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </select>

      {/* Sale type chips */}
      <div className="flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shrink-0">
        {SALE_TYPE_OPTIONS.map(type => (
          <button
            key={type}
            type="button"
            onClick={() => handleSaleType(type)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeSaleType === type
                ? 'bg-accent text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* District */}
      <FilterDropdown
        options={meta?.districts ?? []}
        value={filters.districts?.[0] ?? ''}
        onChange={v => updateFilter('districts', v ? [v] : [])}
        placeholder="District"
        active={!!filters.districts?.length}
      />

      {/* Property type */}
      <FilterDropdown
        options={meta?.propertyTypes ?? []}
        value={filters.propertyTypes?.[0] ?? ''}
        onChange={v => updateFilter('propertyTypes', v ? [v] : [])}
        placeholder="Property type"
        active={!!filters.propertyTypes?.length}
      />

      {/* Layout */}
      <FilterDropdown
        options={meta?.layouts ?? []}
        value={filters.layouts?.[0] ?? ''}
        onChange={v => updateFilter('layouts', v ? [v] : [])}
        placeholder="Layout"
        active={!!filters.layouts?.length}
      />

      {/* Clear all */}
      {isActive && (
        <button
          type="button"
          onClick={handleReset}
          className="shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-accent dark:hover:text-accent transition-colors whitespace-nowrap"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
          Clear
        </button>
      )}
    </div>
  )
}

function FilterDropdown({ options, value, onChange, placeholder, active }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={pillClass(active)}
      style={{ backgroundImage: 'none' }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
