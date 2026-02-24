export function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-accent border-accent text-white'
          : 'border-slate-600 text-slate-400 hover:border-slate-400'
      }`}
    >
      {label}
    </button>
  )
}
