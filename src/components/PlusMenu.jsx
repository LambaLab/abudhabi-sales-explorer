import { useState, useRef, useEffect } from 'react'
import { getDateRangeLabel, PRESETS, toYM } from './DateRangePickerPopover'

/**
 * Converts settings (defaultDateRange + customFrom/To) to a { dateFrom, dateTo } pair.
 */
function settingsToRange(settings) {
  if (settings.defaultDateRange === 'all') return { dateFrom: '', dateTo: '' }
  if (settings.defaultDateRange === 'custom') {
    return { dateFrom: settings.customFrom ?? '', dateTo: settings.customTo ?? '' }
  }
  const months = settings.defaultDateRange === '12m' ? 12
               : settings.defaultDateRange === '24m' ? 24 : 12
  const now   = new Date()
  const to    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const fromD = new Date(now.getFullYear(), now.getMonth() - months, 1)
  const from  = `${fromD.getFullYear()}-${String(fromD.getMonth() + 1).padStart(2, '0')}`
  return { dateFrom: from, dateTo: to }
}

/**
 * Elegant + menu inside ChatInput pill.
 * view='main'  → Date Range row (›) + Chart Type toggle
 * view='dates' → Back header + 6 presets + custom month inputs
 */
export function PlusMenu({ settings, onSettingsChange }) {
  const [open, setOpen]             = useState(false)
  const [view, setView]             = useState('main')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const ref = useRef(null)

  // Reset to main view when popover closes
  useEffect(() => {
    if (!open) setView('main')
  }, [open])

  // Seed custom inputs when entering dates view
  useEffect(() => {
    if (view === 'dates') {
      setCustomFrom(settings.customFrom ?? '')
      setCustomTo(settings.customTo ?? '')
    }
  }, [view, settings.customFrom, settings.customTo])

  // Close on outside click
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

  function handlePreset(preset) {
    const r = preset.fn()
    onSettingsChange({ defaultDateRange: 'custom', customFrom: toYM(r.from), customTo: toYM(r.to) })
    setOpen(false)
  }

  function handleCustomApply() {
    if (!customFrom || !customTo) return
    onSettingsChange({ defaultDateRange: 'custom', customFrom, customTo })
    setOpen(false)
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
        <div className="absolute bottom-full left-0 mb-2 w-72 z-30 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">

          {view === 'main' ? (
            <>
              {/* Row 1 — Date Range (navigates to dates view) */}
              <button
                type="button"
                onClick={() => setView('dates')}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left rounded-t-2xl"
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
            </>
          ) : (
            <>
              {/* Dates sub-panel header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setView('main')}
                  className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 shrink-0"
                  aria-label="Back"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Date Range</span>
              </div>

              {/* Presets */}
              <div className="p-2">
                {PRESETS.map(preset => {
                  const r = preset.fn()
                  const isActive = toYM(r.from) === range.dateFrom && toYM(r.to) === range.dateTo
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handlePreset(preset)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>

              {/* Custom range inputs */}
              <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Custom range</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="month"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 px-2 py-1.5 focus:outline-none focus:border-accent"
                  />
                  <span className="text-slate-400 text-xs shrink-0">→</span>
                  <input
                    type="month"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 px-2 py-1.5 focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCustomApply}
                  disabled={!customFrom || !customTo}
                  className="mt-2 w-full rounded-lg bg-accent text-white text-xs font-medium py-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  Apply
                </button>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  )
}
