export function DateRangePicker({ meta, filters, update }) {
  if (!meta) return null
  const minStr = meta.minDate?.toISOString?.()?.slice(0, 10) ?? '2019-01-01'
  const maxStr = meta.maxDate?.toISOString?.()?.slice(0, 10) ?? '2026-12-31'

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500">From</span>
      <input
        type="date"
        min={minStr}
        max={filters.dateTo || maxStr}
        value={filters.dateFrom || minStr}
        onChange={e => update('dateFrom', e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs"
      />
      <span className="text-slate-500">to</span>
      <input
        type="date"
        min={filters.dateFrom || minStr}
        max={maxStr}
        value={filters.dateTo || maxStr}
        onChange={e => update('dateTo', e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs"
      />
    </div>
  )
}
