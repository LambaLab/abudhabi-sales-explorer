import { useState, useRef, useEffect } from 'react'
import { DateRangePickerPopover, getDateRangeLabel } from './DateRangePickerPopover'

/**
 * Converts settings (defaultDateRange + customFrom/To) to a { dateFrom, dateTo } pair
 * that DateRangePickerPopover understands.
 */
function settingsToRange(settings) {
  if (settings.defaultDateRange === 'all') return { dateFrom: '', dateTo: '' }
  if (settings.defaultDateRange === 'custom') {
    return { dateFrom: settings.customFrom ?? '', dateTo: settings.customTo ?? '' }
  }
  // Legacy preset keys — compute dates
  const months = settings.defaultDateRange === '12m' ? 12
               : settings.defaultDateRange === '24m' ? 24 : 12
  const now    = new Date()
  const to     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const fromD  = new Date(now.getFullYear(), now.getMonth() - months, 1)
  const from   = `${fromD.getFullYear()}-${String(fromD.getMonth() + 1).padStart(2, '0')}`
  return { dateFrom: from, dateTo: to }
}

/**
 * Elegant + menu inside ChatInput pill.
 * Circle button → popover card with Date Range and Chart Type rows.
 */
export function PlusMenu({ settings, onSettingsChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const range     = settingsToRange(settings)
  const dateLabel = getDateRangeLabel(range.dateFrom, range.dateTo)

  function handleDateChange({ dateFrom, dateTo }) {
    onSettingsChange({ defaultDateRange: 'custom', customFrom: dateFrom, customTo: dateTo })
  }

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Circle + button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors ml-1"
        title="Options"
        aria-label="Open options menu"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/>
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 z-30 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">

          {/* Row 1 — Date Range */}
          <div className="p-2">
            <DateRangePickerPopover
              value={range}
              onChange={handleDateChange}
              trigger={
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30 text-lg shrink-0">
                    📅
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-none mb-0.5">Date Range</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{dateLabel}</p>
                  </div>
                  <svg className="h-4 w-4 text-slate-300 dark:text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              }
            />
          </div>

          <div className="mx-4 border-t border-slate-100 dark:border-slate-700" />

          {/* Row 2 — Chart Type */}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30 text-lg shrink-0">
              📊
            </span>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1">Chart Type</p>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
              {['bar', 'line'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onSettingsChange({ chartType: type })}
                  className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    settings.chartType === type
                      ? 'bg-accent text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
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
