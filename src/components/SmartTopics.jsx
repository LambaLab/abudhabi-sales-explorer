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

export function SmartTopics({ onSelect, isLoading }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TOPICS.map(topic => (
        <button
          key={topic}
          onClick={() => onSelect(topic)}
          disabled={isLoading}
          className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-accent hover:text-white disabled:opacity-40"
        >
          {topic}
        </button>
      ))}
    </div>
  )
}
