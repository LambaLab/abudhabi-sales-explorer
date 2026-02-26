import { useState, useRef, useCallback } from 'react'
import { SuggestionsOverlay } from './SuggestionsOverlay'
import { PlusMenu }           from './PlusMenu'

/**
 * ChatGPT-style pill input with:
 *  - SuggestionsOverlay on focus (fills input, does not submit)
 *  - PlusMenu (+) with settings (default date range)
 *  - Submit button → Stop button while isLoading
 */
export function ChatInput({ onSubmit, onStop, isLoading, settings, onSettingsChange }) {
  const [value, setValue]         = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const textareaRef               = useRef(null)

  const handleSubmit = useCallback((e) => {
    e?.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSubmit(trimmed)
    setValue('')
    setShowSuggestions(false)
  }, [value, isLoading, onSubmit])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') setShowSuggestions(false)
  }

  function handleFocus() { setShowSuggestions(true) }
  function handleBlur()  {
    // Delay so onMouseDown in SuggestionsOverlay can fire first
    setTimeout(() => setShowSuggestions(false), 150)
  }

  return (
    <div className="flex items-end gap-2">
      {/* + menu */}
      <PlusMenu settings={settings} onSettingsChange={onSettingsChange} />

      {/* Input pill */}
      <form onSubmit={handleSubmit} className="relative flex-1">
        {showSuggestions && !value && (
          <SuggestionsOverlay
            onFill={topic => { setValue(topic); textareaRef.current?.focus() }}
            onClose={() => setShowSuggestions(false)}
          />
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Ask anything about Abu Dhabi real estate…"
          rows={1}
          disabled={isLoading}
          style={{ resize: 'none', minHeight: '44px', maxHeight: '128px', overflowY: 'auto' }}
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-3 pr-12 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 transition-colors shadow-sm dark:shadow-none"
        />

        {/* Submit / Stop button */}
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
            aria-label="Stop"
            title="Stop analysis"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2"/>
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white transition-opacity disabled:opacity-30 hover:opacity-90"
            aria-label="Submit"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        )}
      </form>
    </div>
  )
}
