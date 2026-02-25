import { useState } from 'react'

export function ChatInput({ onSubmit, isLoading }) {
  const [value, setValue] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSubmit(trimmed)
    setValue('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about Abu Dhabi real estate… e.g. &quot;3BR prices in Noya vs Yas Island last year&quot;"
        rows={2}
        disabled={isLoading}
        className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 pr-14 text-sm text-slate-100 placeholder-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 transition-colors"
      />
      <button
        type="submit"
        disabled={!value.trim() || isLoading}
        className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-opacity disabled:opacity-30 hover:opacity-90"
        aria-label="Submit"
      >
        {isLoading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        )}
      </button>
    </form>
  )
}
