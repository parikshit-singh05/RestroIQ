export interface InvFilterState {
  week: string
  category: string
  centerId: string
}

interface Props {
  filters: InvFilterState
  setFilters: React.Dispatch<React.SetStateAction<InvFilterState>>
  distinctWeeks: string[]
  distinctCategories: string[]
  distinctCenters: string[]
}

export function InventoryFilters({ filters, setFilters, distinctWeeks, distinctCategories, distinctCenters }: Props) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 lg:p-5 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
      <FilterSelect label="Target Week" value={filters.week} options={distinctWeeks} onChange={(v) => setFilters(prev => ({ ...prev, week: v }))} placeholder="Select Week" />
      <FilterSelect label="Category" value={filters.category} options={distinctCategories} onChange={(v) => setFilters(prev => ({ ...prev, category: v }))} placeholder="All Categories" />
      <FilterSelect label="Center" value={filters.centerId} options={distinctCenters} onChange={(v) => setFilters(prev => ({ ...prev, centerId: v }))} placeholder="All Centers" />
    </div>
  )
}

function FilterSelect({ label, value, options, onChange, placeholder }: { label: string, value: string, options: string[], onChange: (v: string) => void, placeholder: string }) {
  return (
    <div className="flex flex-col flex-1">
      <label className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-[13px] font-medium text-[var(--color-text)] py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all cursor-pointer"
        >
          {label !== 'Target Week' && <option value="">{placeholder}</option>}
          {options.map(o => (
            <option key={o} value={o}>{label === 'Target Week' ? `Week ${o}` : o}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-tertiary)]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
    </div>
  )
}
