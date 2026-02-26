/**
 * Compact per-chart date range override.
 * Shown in the top-right corner of chart cards in the Chart tab.
 * `value` = { dateFrom: 'YYYY-MM', dateTo: 'YYYY-MM' }
 */
export function InlineDateRange({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
      <input
        type="month"
        value={value?.dateFrom ?? ''}
        onChange={e => onChange({ ...value, dateFrom: e.target.value })}
        className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400 focus:outline-none focus:border-accent"
      />
      <span>–</span>
      <input
        type="month"
        value={value?.dateTo ?? ''}
        onChange={e => onChange({ ...value, dateTo: e.target.value })}
        className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400 focus:outline-none focus:border-accent"
      />
    </div>
  )
}
