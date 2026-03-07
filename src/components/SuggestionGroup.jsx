import { useState, useRef, useEffect } from 'react'

/**
 * Grouped suggestion container — Claude Code-style rows.
 *
 * Props:
 *   suggestions:      [{label, query, reason}]  — validated suggestions to display
 *   postId:           string                    — passed to onReply as first arg
 *   onReply:          (postId, query) => void   — called when user picks a suggestion
 *   disabled:         boolean                   — greys out all rows
 *   showTypeAnything: boolean                   — show "Type something else…" as last row (PostCard only)
 */
export function SuggestionGroup({ suggestions, postId, onReply, disabled = false, showTypeAnything = false }) {
  const [typeOpen, setTypeOpen] = useState(false)
  const [typeValue, setTypeValue] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (typeOpen) textareaRef.current?.focus()
  }, [typeOpen])

  if (!suggestions?.length) return null

  function handleTypeSubmit(e) {
    e.preventDefault()
    const trimmed = typeValue.trim()
    if (!trimmed || disabled) return
    onReply(postId, trimmed)
    setTypeValue('')
    setTypeOpen(false)
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
      {suggestions.map((s, i) => (
        <button
          key={`${i}-${s.label}`}
          type="button"
          disabled={disabled}
          onClick={() => onReply(postId, s.query)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm text-slate-800 dark:text-slate-100 leading-snug">{s.label}</span>
            {s.reason && (
              <span className="text-xs text-slate-400 dark:text-slate-500 leading-snug">{s.reason}</span>
            )}
          </div>
          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500 font-mono w-5 text-right">
            {i + 1}
          </span>
        </button>
      ))}

      {showTypeAnything && (
        typeOpen ? (
          <form
            onSubmit={handleTypeSubmit}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800/60"
          >
            <textarea
              ref={textareaRef}
              value={typeValue}
              onChange={e => setTypeValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) handleTypeSubmit(e)
                if (e.key === 'Escape') { setTypeOpen(false); setTypeValue('') }
              }}
              placeholder="Ask a follow-up…"
              rows={1}
              disabled={disabled}
              style={{ resize: 'none', minHeight: '32px', maxHeight: '96px', overflowY: 'auto' }}
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!typeValue.trim() || disabled}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-30 hover:opacity-80 transition-opacity"
              aria-label="Submit"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTypeOpen(true)}
            className="w-full px-4 py-3 text-left text-sm italic text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Type something else…
          </button>
        )
      )}
    </div>
  )
}
