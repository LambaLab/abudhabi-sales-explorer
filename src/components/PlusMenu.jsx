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

function isValidYM(v) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

/**
 * Elegant + menu inside ChatInput pill.
 * view = 'main'  → Date Range row (›) + Chart Type row (›)
 * view = 'dates' → Back + 6 presets + custom month inputs
 * view = 'chart' → Back + Bar / Line options
 */
export function PlusMenu({ settings, onSettingsChange }) {
  const [open, setOpen]             = useState(false)
  const [view, setView]             = useState('main')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [customError, setCustomError] = useState('')
  const ref = useRef(null)

  // Reset to main view when popover closes
  useEffect(() => {
    if (!open) { setView('main'); setCustomError('') }
  }, [open])

  // Seed custom inputs when entering dates view
  useEffect(() => {
    if (view === 'dates') {
      setCustomFrom(settings.customFrom ?? '')
      setCustomTo(settings.customTo ?? '')
      setCustomError('')
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
    setCustomError('')
    setOpen(false)
  }

  function handleCustomApply() {
    if (!isValidYM(customFrom) || !isValidYM(customTo)) {
      setCustomError('Use format YYYY-MM (e.g. 2025-01)')
      return
    }
    if (customFrom > customTo) {
      setCustomError('"From" must be before "To"')
      return
    }
    setCustomError('')
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

          {/* ── Main view ── */}
          {view === 'main' && (
            <>
              {/* Date Range row */}
              <button
                type="button"
                onClick={() => setView('dates')}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left rounded-t-2xl"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 shrink-0">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
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

              {/* Chart Type row — navigates to sub-panel */}
              <button
                type="button"
                onClick={() => setView('chart')}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left rounded-b-2xl"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 shrink-0">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-none mb-0.5">Chart Type</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{settings.chartType ?? 'bar'}</p>
                </div>
                <svg className="h-4 w-4 text-slate-300 dark:text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </>
          )}

          {/* ── Dates sub-panel ── */}
          {view === 'dates' && (
            <>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => { setView('main'); setCustomError('') }}
                  className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 shrink-0"
                  aria-label="Back"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Date Range</span>
              </div>

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

              <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Custom range</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="month"
                    value={customFrom}
                    onChange={e => { setCustomFrom(e.target.value); setCustomError('') }}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 px-2 py-1.5 focus:outline-none focus:border-accent"
                  />
                  <span className="text-slate-400 text-xs shrink-0">→</span>
                  <input
                    type="month"
                    value={customTo}
                    onChange={e => { setCustomTo(e.target.value); setCustomError('') }}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 px-2 py-1.5 focus:outline-none focus:border-accent"
                  />
                </div>
                {customError && (
                  <p className="text-[10px] text-red-400 mt-1">{customError}</p>
                )}
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

          {/* ── Chart Type sub-panel ── */}
          {view === 'chart' && (
            <>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => { setView('main'); setCustomError('') }}
                  className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 shrink-0"
                  aria-label="Back"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Chart Type</span>
              </div>

              <div className="p-2">
                {['bar', 'line'].map(type => {
                  const isActive = (settings.chartType ?? 'bar') === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { onSettingsChange({ chartType: type }); setOpen(false) }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm capitalize transition-colors ${
                        isActive
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isActive ? (
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      ) : (
                        <span className="h-4 w-4 shrink-0 inline-block" />
                      )}
                      {type}
                    </button>
                  )
                })}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  )
}
