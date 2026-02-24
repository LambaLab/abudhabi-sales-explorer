import Select from 'react-select'
import { FilterPill } from './FilterPill'

const selectStyles = {
  control: (b) => ({ ...b, backgroundColor: '#1a1a2e', borderColor: '#374151', minHeight: 32 }),
  menu: (b) => ({ ...b, backgroundColor: '#1a1a2e', zIndex: 50 }),
  option: (b, s) => ({ ...b, backgroundColor: s.isFocused ? '#374151' : '#1a1a2e', color: '#e2e8f0' }),
  multiValue: (b) => ({ ...b, backgroundColor: '#374151' }),
  multiValueLabel: (b) => ({ ...b, color: '#e2e8f0' }),
  multiValueRemove: (b) => ({ ...b, color: '#9ca3af', ':hover': { backgroundColor: '#e94560', color: '#fff' } }),
  input: (b) => ({ ...b, color: '#e2e8f0' }),
  placeholder: (b) => ({ ...b, color: '#6b7280' }),
  singleValue: (b) => ({ ...b, color: '#e2e8f0' }),
}

const toOptions = (arr) => arr.map(v => ({ value: v, label: v }))

export function Sidebar({ meta, filters, update, reset }) {
  const saleTypeOptions = ['all', 'off-plan', 'ready', 'court-mandated']
  const marketOptions = ['all', 'primary', 'secondary']

  return (
    <div className="p-4 space-y-5">
      {/* Reset */}
      <button
        onClick={reset}
        className="w-full text-xs text-slate-400 hover:text-white border border-slate-700 rounded py-1.5 transition-colors"
      >
        Reset all filters
      </button>

      {/* District */}
      <FilterSection label="District">
        <Select
          isMulti
          options={toOptions(meta.districts)}
          styles={selectStyles}
          placeholder="All districts…"
          value={filters.districts.map(v => ({ value: v, label: v }))}
          onChange={opts => update('districts', opts.map(o => o.value))}
        />
      </FilterSection>

      {/* Property Type */}
      <FilterSection label="Property Type">
        <Select
          isMulti
          options={toOptions(meta.propertyTypes)}
          styles={selectStyles}
          placeholder="All types…"
          value={filters.propertyTypes.map(v => ({ value: v, label: v }))}
          onChange={opts => update('propertyTypes', opts.map(o => o.value))}
        />
      </FilterSection>

      {/* Layout */}
      <FilterSection label="Layout">
        <Select
          isMulti
          options={toOptions(meta.layouts)}
          styles={selectStyles}
          placeholder="All layouts…"
          value={filters.layouts.map(v => ({ value: v, label: v }))}
          onChange={opts => update('layouts', opts.map(o => o.value))}
        />
      </FilterSection>

      {/* Sale Type */}
      <FilterSection label="Sale Type">
        <div className="flex flex-wrap gap-1.5">
          {saleTypeOptions.map(opt => (
            <FilterPill
              key={opt}
              label={opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)}
              active={
                opt === 'all'
                  ? filters.saleTypes.length === 0
                  : filters.saleTypes.includes(opt)
              }
              onClick={() => {
                if (opt === 'all') update('saleTypes', [])
                else {
                  const next = filters.saleTypes.includes(opt)
                    ? filters.saleTypes.filter(v => v !== opt)
                    : [...filters.saleTypes, opt]
                  update('saleTypes', next)
                }
              }}
            />
          ))}
        </div>
      </FilterSection>

      {/* Market */}
      <FilterSection label="Market">
        <div className="flex flex-wrap gap-1.5">
          {marketOptions.map(opt => (
            <FilterPill
              key={opt}
              label={opt.charAt(0).toUpperCase() + opt.slice(1)}
              active={
                opt === 'all'
                  ? filters.saleSequences.length === 0
                  : filters.saleSequences.includes(opt)
              }
              onClick={() => {
                if (opt === 'all') update('saleSequences', [])
                else {
                  const next = filters.saleSequences.includes(opt)
                    ? filters.saleSequences.filter(v => v !== opt)
                    : [...filters.saleSequences, opt]
                  update('saleSequences', next)
                }
              }}
            />
          ))}
        </div>
      </FilterSection>

      {/* Price Range */}
      <FilterSection label="Price Range (AED)">
        <div className="space-y-2">
          <input
            type="number"
            placeholder="Min price"
            value={filters.priceMin ?? ''}
            onChange={e => update('priceMin', e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600"
          />
          <input
            type="number"
            placeholder="Max price"
            value={filters.priceMax ?? ''}
            onChange={e => update('priceMax', e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600"
          />
        </div>
      </FilterSection>
    </div>
  )
}

function FilterSection({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  )
}
