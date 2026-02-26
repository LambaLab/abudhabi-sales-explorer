import { useState } from 'react'

/**
 * App-level settings persisted to localStorage.
 *
 * defaultDateRange values:
 *   '12m'   = last 12 months (default)
 *   '24m'   = last 24 months
 *   'all'   = all time (no date filter)
 *   'custom' = custom from/to (uses customFrom + customTo)
 */

const DEFAULTS = {
  defaultDateRange: '12m',
  customFrom: '',
  customTo: '',
}

function load() {
  try {
    const raw = localStorage.getItem('ad_settings')
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

function save(s) {
  try { localStorage.setItem('ad_settings', JSON.stringify(s)) } catch {}
}

/**
 * Returns { settings, updateSettings, getDateRangeHint }
 *
 * getDateRangeHint() → string appended to every analyze() prompt so Claude
 * applies the default range unless the user's query overrides it.
 */
export function useSettings() {
  const [settings, setSettings] = useState(load)

  function updateSettings(partial) {
    setSettings(prev => {
      const next = { ...prev, ...partial }
      save(next)
      return next
    })
  }

  function getDateRangeHint() {
    switch (settings.defaultDateRange) {
      case '12m':  return ' [Default time range: last 12 months — apply unless the query specifies otherwise]'
      case '24m':  return ' [Default time range: last 24 months — apply unless the query specifies otherwise]'
      case 'all':  return ''
      case 'custom':
        if (settings.customFrom && settings.customTo)
          return ` [Default time range: ${settings.customFrom} to ${settings.customTo} — apply unless the query specifies otherwise]`
        return ''
      default:     return ''
    }
  }

  return { settings, updateSettings, getDateRangeHint }
}
