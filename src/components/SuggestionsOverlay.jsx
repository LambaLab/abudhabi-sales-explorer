const TOPICS = [
  '3BR prices: Al Reem Island vs Yas Island vs Saadiyat',
  'Transaction volume by district in 2024',
  'How have off-plan apartment prices trended since 2022?',
  'Studio price per sqm across Abu Dhabi since 2020',
  'Most sold projects by volume in 2024',
  'Noya Phase 1 price trend over the last 2 years',
  '1BR vs 2BR vs 3BR prices on Yas Island',
  'Ready vs off-plan price gap since 2021',
]

/**
 * Dropdown of suggested analyses, shown when input is focused.
 * Clicking a suggestion fills the input — does NOT submit.
 */
export function SuggestionsOverlay({ onFill, onClose }) {
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
      <p className="px-3 pt-2.5 pb-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
        Suggested analyses
      </p>
      {TOPICS.map(topic => (
        <button
          key={topic}
          onMouseDown={e => {
            // mousedown fires before blur — prevents overlay closing before click registers
            e.preventDefault()
            onFill(topic)
            onClose()
          }}
          className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
        >
          {topic}
        </button>
      ))}
    </div>
  )
}
