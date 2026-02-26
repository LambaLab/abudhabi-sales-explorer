import { useState, useEffect } from 'react'

const LABELS = [
  'Analyzing…',
  'Thinking…',
  'Crunching numbers…',
  'Building chart…',
  'Querying data…',
  'Almost there…',
]

/**
 * Cycles through thinking labels every 1.5 seconds.
 * Used in post cards while status is 'analyzing' | 'querying' | 'explaining'.
 */
export function ThinkingLabel() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % LABELS.length), 1500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm py-4">
      <svg
        className="h-4 w-4 animate-spin shrink-0 text-accent"
        viewBox="0 0 24 24" fill="none"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="transition-all duration-300">{LABELS[idx]}</span>
    </div>
  )
}
