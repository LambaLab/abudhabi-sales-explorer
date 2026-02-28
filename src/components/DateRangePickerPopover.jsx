import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import {
  format, subDays, subMonths, subYears,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, subQuarters,
  startOfYear, endOfYear,
} from 'date-fns'

/** Convert a Date to 'YYYY-MM' string */
export function toYM(d) {
  if (!d) return ''
  return format(d, 'yyyy-MM')
}

/** Convert 'YYYY-MM' string to a Date (first day of that month) */
function fromYM(s) {
  if (!s) return undefined
  const [y, m] = s.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** Validate that a string is a valid YYYY-MM month */
function isValidYM(v) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

export const PRESETS = [
  { label: 'Last 30 days',   fn: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Last month',     fn: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Last 90 days',   fn: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  { label: 'Last quarter',   fn: () => ({ from: startOfQuarter(subQuarters(new Date(), 1)), to: endOfQuarter(subQuarters(new Date(), 1)) }) },
  { label: 'Last 12 months', fn: () => ({ from: subMonths(new Date(), 12), to: new Date() }) },
  { label: 'Last year',      fn: () => ({ from: startOfYear(subYears(new Date(), 1)), to: endOfYear(subYears(new Date(), 1)) }) },
]

/** Return the display label for a date range, matching a preset if possible */
export function getDateRangeLabel(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return 'All time'
  for (const p of PRESETS) {
    const r = p.fn()
    if (toYM(r.from) === dateFrom && toYM(r.to) === dateTo) return p.label
  }
  if (dateFrom && dateTo) return `${dateFrom} – ${dateTo}`
  if (dateFrom) return `From ${dateFrom}`
  return 'Custom'
}

/**
 * DateRangePickerPopover
 *
 * Props:
 *   value        { dateFrom: 'YYYY-MM', dateTo: 'YYYY-MM' }
 *   onChange     ({ dateFrom, dateTo }) => void
 *   align        'left' | 'right' | 'down'  (default 'left')
 *                'left'/'right' open upward; 'down' opens downward.
 *   trigger      optional ReactNode — custom trigger element
 */
export function DateRangePickerPopover({ value, onChange, align = 'left', trigger }) {
  const [open, setOpen]   = useState(false)
  const [range, setRange] = useState({ from: fromYM(value?.dateFrom), to: fromYM(value?.dateTo) })
  const [month, setMonth] = useState(fromYM(value?.dateFrom) ?? new Date())
  const [manualFrom, setManualFrom] = useState(value?.dateFrom ?? '')
  const [manualTo,   setManualTo]   = useState(value?.dateTo   ?? '')
  const [validationError, setValidationError] = useState('')
  const popRef = useRef(null)
  const btnRef = useRef(null)

  // Sync internal state when value prop changes
  useEffect(() => {
    setRange({ from: fromYM(value?.dateFrom), to: fromYM(value?.dateTo) })
    setManualFrom(value?.dateFrom ?? '')
    setManualTo(value?.dateTo ?? '')
  }, [value?.dateFrom, value?.dateTo])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Calendar selection → sync manual inputs
  function handleSelect(newRange) {
    setRange(newRange)
    setValidationError('')
    if (newRange?.from) setManualFrom(toYM(newRange.from))
    if (newRange?.to)   setManualTo(toYM(newRange.to))
  }

  function applyPreset(preset) {
    const r = preset.fn()
    onChange({ dateFrom: toYM(r.from), dateTo: toYM(r.to) })
    setOpen(false)
  }

  function applyRange() {
    if (!isValidYM(manualFrom) || !isValidYM(manualTo)) {
      setValidationError('Use format YYYY-MM (e.g. 2025-01)')
      return
    }
    if (manualFrom > manualTo) {
      setValidationError('"From" must be before "To"')
      return
    }
    onChange({ dateFrom: manualFrom, dateTo: manualTo })
    setOpen(false)
  }

  function handleCancel() {
    setRange({ from: fromYM(value?.dateFrom), to: fromYM(value?.dateTo) })
    setManualFrom(value?.dateFrom ?? '')
    setManualTo(value?.dateTo ?? '')
    setValidationError('')
    setOpen(false)
  }

  const label    = getDateRangeLabel(value?.dateFrom, value?.dateTo)
  const isActive = !!(value?.dateFrom || value?.dateTo)

  const triggerEl = trigger ? (
    <div ref={btnRef} onClick={() => setOpen(o => !o)} className="cursor-pointer">
      {trigger}
    </div>
  ) : (
    <button
      ref={btnRef}
      type="button"
      onClick={() => setOpen(o => !o)}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
        isActive
          ? 'border-accent text-accent bg-accent/5 dark:bg-accent/10'
          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      {label}
    </button>
  )

  // Vertical: 'down' opens below trigger; everything else opens above
  const verticalClass   = align === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'
  // Horizontal: 'right' aligns right edge; everything else aligns left edge
  const horizontalClass = align === 'right' ? 'right-0' : 'left-0'

  return (
    <div className="relative">
      {triggerEl}

      {open && (
        <div
          ref={popRef}
          className={`absolute ${verticalClass} ${horizontalClass} z-50 flex flex-row w-[440px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden`}
        >
          {/* Left — Presets */}
          <div className="w-36 shrink-0 border-r border-slate-100 dark:border-slate-700 p-3 flex flex-col">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide px-2 mb-2">
              Quick select
            </p>
            <div className="flex flex-col gap-0.5">
              {PRESETS.map(preset => {
                const r = preset.fn()
                const isPresetActive = toYM(r.from) === value?.dateFrom && toYM(r.to) === value?.dateTo
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      isPresetActive
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right — Calendar + manual inputs + buttons */}
          <div className="flex-1 p-3 flex flex-col min-w-0">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={handleSelect}
              month={month}
              onMonthChange={setMonth}
              numberOfMonths={1}
              showOutsideDays={false}
              classNames={{
                root:            'relative',
                nav:             'absolute top-0 inset-x-0 flex justify-between items-center px-1 h-8 z-10',
                button_previous: 'h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400',
                button_next:     'h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400',
                months:          'flex gap-6 pt-8',
                month:           'w-full',
                month_caption:   'text-center mb-3',
                caption_label:   'text-sm font-semibold text-slate-800 dark:text-slate-200',
                month_grid:      'w-full border-collapse',
                weekdays:        'flex mb-1',
                weekday:         'w-9 text-center text-xs font-medium text-slate-400 dark:text-slate-500',
                week:            'flex mt-1',
                day:             'relative h-9 w-9 text-center p-0',
                day_button:      'h-9 w-9 rounded-full flex items-center justify-center text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors w-full',
                selected:        'bg-accent! text-white! hover:bg-accent! rounded-full',
                today:           'font-bold text-accent',
                outside:         'opacity-0 pointer-events-none',
                disabled:        'opacity-30 cursor-not-allowed',
                range_start:     'bg-accent! text-white! rounded-full',
                range_end:       'bg-accent! text-white! rounded-full',
                range_middle:    'bg-accent/15! text-accent! rounded-none',
                hidden:          'invisible',
              }}
            />

            {/* Manual From / To inputs */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <div className="flex-1">
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">From</p>
                <input
                  type="month"
                  value={manualFrom}
                  onChange={e => { setManualFrom(e.target.value); setValidationError('') }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 px-2 py-1.5 focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">To</p>
                <input
                  type="month"
                  value={manualTo}
                  onChange={e => { setManualTo(e.target.value); setValidationError('') }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-800 dark:text-slate-200 px-2 py-1.5 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {validationError && (
              <p className="text-[10px] text-red-400 mt-1">{validationError}</p>
            )}

            {/* Apply / Cancel */}
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyRange}
                disabled={!manualFrom && !range?.from}
                className="px-4 py-1.5 rounded-lg text-sm bg-accent text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
