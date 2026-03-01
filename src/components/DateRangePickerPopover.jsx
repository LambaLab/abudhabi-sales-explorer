import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
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

/** Convert 'YYYY-MM' string to a Date (first day of that month). Returns undefined for invalid input. */
function fromYM(s) {
  if (!isValidYM(s)) return undefined
  const [y, m] = s.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** Validate that a string is a valid YYYY-MM month */
function isValidYM(v) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

/** Defaults used when no date is set ("All time") */
const DEFAULT_FROM = '2020-01'
function getDefaultTo() { return toYM(new Date()) }

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
 *   value    { dateFrom: 'YYYY-MM', dateTo: 'YYYY-MM' }
 *   onChange ({ dateFrom, dateTo }) => void
 *   align    'left' | 'right' | 'down'  (default 'left')
 *            Smart flip: opens above unless < 420px space above trigger.
 *            'down' forces opening below regardless of space.
 *   trigger  optional ReactNode — custom trigger element
 *
 * The popover is rendered via createPortal at document.body with position:fixed
 * to avoid clipping by any overflow container in the parent tree.
 */
export function DateRangePickerPopover({ value, onChange, align = 'left', trigger }) {
  const initFrom = value?.dateFrom || DEFAULT_FROM
  const initTo   = value?.dateTo   || getDefaultTo()

  const [open, setOpen]   = useState(false)
  const [range, setRange] = useState({ from: fromYM(initFrom), to: fromYM(initTo) })
  const [month, setMonth] = useState(fromYM(initFrom) ?? new Date())
  const [manualFrom, setManualFrom] = useState(initFrom)
  const [manualTo,   setManualTo]   = useState(initTo)
  const [validationError, setValidationError] = useState('')
  const [pos, setPos] = useState(null)
  const popRef = useRef(null)
  const btnRef = useRef(null)

  /** Compute fixed position from the trigger's bounding rect */
  function computePos(alignValue) {
    if (!btnRef.current) return null
    const r     = btnRef.current.getBoundingClientRect()
    const POPUP_H = 420
    const POPUP_W = 440
    const vpW = window.innerWidth
    const vpH = window.innerHeight
    // Go down if forced or not enough space above
    const goDown = alignValue === 'down' || r.top < POPUP_H + 16
    // Horizontal: right-align means right edge of popup = right edge of trigger
    const rawLeft = alignValue === 'right' ? r.right - POPUP_W : r.left
    const left = Math.max(8, Math.min(rawLeft, vpW - POPUP_W - 8))
    return goDown
      ? { top: r.bottom + 8, left }
      : { bottom: vpH - r.top + 8, left }
  }

  // Sync internal state when value prop changes from outside
  useEffect(() => {
    const from = value?.dateFrom || DEFAULT_FROM
    const to   = value?.dateTo   || getDefaultTo()
    setRange({ from: fromYM(from), to: fromYM(to) })
    setManualFrom(from)
    setManualTo(to)
    setMonth(fromYM(from) ?? new Date())
  }, [value?.dateFrom, value?.dateTo])

  // Compute position synchronously after open state changes (before paint)
  useLayoutEffect(() => {
    if (open) setPos(computePos(align))
    else { setPos(null); setValidationError('') }
  }, [open, align])

  // Close on: outside click, Escape key, any scroll
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  // Calendar selection → sync manual inputs
  function handleSelect(newRange) {
    setRange(newRange)
    setValidationError('')
    setManualFrom(newRange?.from ? toYM(newRange.from) : '')
    setManualTo(newRange?.to   ? toYM(newRange.to)   : '')
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
    // Preserve "All time" if the underlying was empty and the user hasn't changed
    // the display defaults — avoids silently converting "All time" to a concrete range.
    const wasAllTime = !value?.dateFrom && !value?.dateTo
    if (wasAllTime && manualFrom === DEFAULT_FROM && manualTo === getDefaultTo()) {
      onChange({ dateFrom: '', dateTo: '' })
    } else {
      onChange({ dateFrom: manualFrom, dateTo: manualTo })
    }
    setOpen(false)
  }

  function handleCancel() {
    const from = value?.dateFrom || DEFAULT_FROM
    const to   = value?.dateTo   || getDefaultTo()
    setRange({ from: fromYM(from), to: fromYM(to) })
    setManualFrom(from)
    setManualTo(to)
    setValidationError('')
    setOpen(false)
  }

  const label    = getDateRangeLabel(value?.dateFrom, value?.dateTo)
  const isActive = !!(value?.dateFrom || value?.dateTo)

  function toggleOpen() { setOpen(o => !o) }

  const triggerEl = trigger ? (
    <div ref={btnRef} onClick={toggleOpen} className="cursor-pointer">
      {trigger}
    </div>
  ) : (
    <button
      ref={btnRef}
      type="button"
      onClick={toggleOpen}
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

  const popoverContent = (
    <div
      ref={popRef}
      style={{
        position: 'fixed',
        top:    pos?.top,
        bottom: pos?.bottom,
        left:   pos?.left,
        zIndex: 9999,
      }}
      className="flex flex-row w-[440px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden"
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
            day_button:      'h-9 w-9 rounded-full flex items-center justify-center text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors',
            selected:        'rounded-full',
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
  )

  return (
    <div className="relative">
      {triggerEl}
      {open && pos && createPortal(popoverContent, document.body)}
    </div>
  )
}
