export function ChartCard({ title, subtitle, children, empty, headerRight }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm dark:shadow-none">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      {empty ? (
        <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-600 text-sm">
          No data for current filters
        </div>
      ) : (
        children
      )}
    </div>
  )
}
