import { useState, useRef, useEffect } from 'react'

const RANGE_OPTIONS = [
  { value: '12m',    label: 'Last 12 months' },
  { value: '24m',    label: 'Last 24 months' },
  { value: 'all',    label: 'All time' },
  { value: 'custom', label: 'Custom range' },
]

/**
 * + button that opens a popover menu above the input.
 * Currently contains Date Range setting.
 * Extensible: add more menu items as needed.
 */
export function PlusMenu({ settings, onSettingsChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-lg font-light leading-none"
        title="Options"
        aria-label="Open options menu"
      >
        +
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-64 z-30 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-3 space-y-3">
          {/* Date Range */}
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <span>📅</span> Default Date Range
            </p>
            <div className="space-y-1">
              {RANGE_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="radio"
                    name="dateRange"
                    value={opt.value}
                    checked={settings.defaultDateRange === opt.value}
                    onChange={() => onSettingsChange({ defaultDateRange: opt.value })}
                    className="accent-accent"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            {settings.defaultDateRange === 'custom' && (
              <div className="mt-2 flex gap-2">
                <input
                  type="month"
                  value={settings.customFrom}
                  onChange={e => onSettingsChange({ customFrom: e.target.value })}
                  className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent px-2 py-1 text-slate-700 dark:text-slate-300"
                  placeholder="From"
                />
                <input
                  type="month"
                  value={settings.customTo}
                  onChange={e => onSettingsChange({ customTo: e.target.value })}
                  className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent px-2 py-1 text-slate-700 dark:text-slate-300"
                  placeholder="To"
                />
              </div>
            )}
          </div>

          {/* Chart Type */}
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <span>📊</span> Chart Type
            </p>
            <div className="flex gap-1">
              {['bar', 'line'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onSettingsChange({ chartType: type })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    settings.chartType === type
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
