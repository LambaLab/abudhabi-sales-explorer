import Select from 'react-select'

const selectStyles = {
  control: (b) => ({ ...b, backgroundColor: '#0f172a', borderColor: '#374151', minHeight: 32 }),
  menu: (b) => ({ ...b, backgroundColor: '#1e293b', zIndex: 50 }),
  option: (b, s) => ({ ...b, backgroundColor: s.isFocused ? '#374151' : '#1e293b', color: '#e2e8f0', fontSize: 12 }),
  multiValue: (b) => ({ ...b, backgroundColor: '#374151' }),
  multiValueLabel: (b) => ({ ...b, color: '#e2e8f0', fontSize: 11 }),
  multiValueRemove: (b) => ({ ...b, color: '#9ca3af', ':hover': { backgroundColor: '#e94560', color: '#fff' } }),
  input: (b) => ({ ...b, color: '#e2e8f0', fontSize: 12 }),
  placeholder: (b) => ({ ...b, color: '#6b7280', fontSize: 12 }),
}

export const COLORS = ['#e94560', '#38bdf8', '#a3e635', '#fb923c', '#c084fc', '#34d399', '#f472b6', '#fbbf24']

export function ProjectSearch({ projects, selected, onChange }) {
  const options = projects.map(p => ({ value: p, label: p }))
  const value = selected.map(p => ({ value: p, label: p }))

  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
        Compare Projects
      </p>
      <Select
        isMulti
        options={options}
        value={value}
        onChange={opts => onChange(opts.map(o => o.value).slice(0, 8))}
        styles={selectStyles}
        placeholder="Search and select projects…"
        noOptionsMessage={() => 'No projects found'}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((p, i) => (
            <span
              key={p}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: COLORS[i % COLORS.length] + '22',
                color: COLORS[i % COLORS.length],
                border: `1px solid ${COLORS[i % COLORS.length]}44`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
