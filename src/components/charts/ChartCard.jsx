export function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {empty ? (
        <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
          No data for current filters
        </div>
      ) : (
        children
      )}
    </div>
  )
}
