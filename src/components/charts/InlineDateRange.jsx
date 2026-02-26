import { useState } from 'react'

const PRESETS = [
  { label: 'Last 12m', key: '12m',  months: 12 },
  { label: 'Last 2y',  key: '24m',  months: 24 },
  { label: 'Last 3y',  key: '36m',  months: 36 },
  { label: 'All time', key: 'all',  months: null },
  { label: 'Custom',   key: 'custom', months: null },
]

function presetToDates(key) {
  if (key === 'all' || key === 'custom') return { dateFrom: '', dateTo: '' }
  const months = PRESETS.find(p => p.key === key)?.months ?? 12
  const now    = new Date()
  const to     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const fromD  = new Date(now.getFullYear(), now.getMonth() - months, 1)
  const from   = `${fromD.getFullYear()}-${String(fromD.getMonth() + 1).padStart(2, '0')}`
  return { dateFrom: from, dateTo: to }
}

/**
 * Compact per-chart date range override.
 * Shows a preset dropdown; "Custom" reveals two YYYY-MM text inputs.
 * `value` = { dateFrom: 'YYYY-MM', dateTo: 'YYYY-MM' }
 */
export function InlineDateRange({ value, onChange }) {
  const [preset, setPreset] = useState(() => {
    if (!value?.dateFrom && !value?.dateTo) return 'all'
    // try to match a known preset
    const now   = new Date()
    const toStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    if (value.dateTo === toStr || !value.dateTo) {
      for (const p of PRESETS.filter(x => x.months)) {
        const { dateFrom } = presetToDates(p.key)
        if (dateFrom === value.dateFrom) return p.key
      }
    }
    return 'custom'
  })
  const [custom, setCustom] = useState(() =>
    (!value?.dateFrom && !value?.dateTo)
      ? { dateFrom: '', dateTo: '' }
      : { dateFrom: value.dateFrom ?? '', dateTo: value.dateTo ?? '' }
  )

  function handlePreset(key) {
    setPreset(key)
    if (key !== 'custom') {
      onChange(presetToDates(key))
    } else {
      onChange({ dateFrom: '', dateTo: '' })
    }
  }

  function handleCustom(field, val) {
    const next = { ...custom, [field]: val }
    setCustom(next)
    onChange(next)
  }

  function handleReset() {
    setPreset('all')
    setCustom({ dateFrom: '', dateTo: '' })
    onChange({ dateFrom: '', dateTo: '' })
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <select
        value={preset}
        onChange={e => handlePreset(e.target.value)}
        className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 focus:outline-none focus:border-accent cursor-pointer transition-colors hover:border-slate-300 dark:hover:border-slate-600"
      >
        {PRESETS.map(p => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </select>

      {preset === 'custom' && (
        <div className="flex items-center gap-1">
          <input
            type="month"
            value={custom.dateFrom}
            onChange={e => handleCustom('dateFrom', e.target.value)}
            className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400 focus:outline-none focus:border-accent"
          />
          <span className="text-slate-400">–</span>
          <input
            type="month"
            value={custom.dateTo}
            onChange={e => handleCustom('dateTo', e.target.value)}
            className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400 focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {preset !== 'all' && (
        <button
          type="button"
          onClick={handleReset}
          title="Reset date range"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}
