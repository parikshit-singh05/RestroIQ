export interface AnalyticsFilterState {
  start_week: string
  end_week: string
  city: string
  centerId: string
  category: string
  cuisine: string
}

interface Props {
  filters: AnalyticsFilterState
  setFilters: React.Dispatch<React.SetStateAction<AnalyticsFilterState>>
  distinctCities: string[]
  distinctCenters: string[]
  distinctCategories: string[]
  distinctCuisines: string[]
}

export function AnalyticsFilters({ filters, setFilters, distinctCities, distinctCenters, distinctCategories, distinctCuisines }: Props) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm mb-10 flex flex-wrap gap-4 items-end">
      
      <div className="flex flex-col">
        <label className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">Horizon (Weeks)</label>
        <div className="flex items-center bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-1.5">
          <input type="number" min="1" max="145" value={filters.start_week} onChange={e => setFilters(f => ({ ...f, start_week: e.target.value }))} className="w-10 bg-transparent text-[13px] font-bold outline-none text-center text-[var(--color-text)]" />
          <span className="text-[13px] font-bold text-[var(--color-text-tertiary)] mx-2">-</span>
          <input type="number" min="1" max="145" value={filters.end_week} onChange={e => setFilters(f => ({ ...f, end_week: e.target.value }))} className="w-10 bg-transparent text-[13px] font-bold outline-none text-center text-[var(--color-text)]" />
        </div>
      </div>
      
      <FilterSelect label="City" value={filters.city} options={distinctCities} onChange={(v) => setFilters(f => ({ ...f, city: v, centerId: '' }))} />
      <FilterSelect label="Center" value={filters.centerId} options={distinctCenters} onChange={(v) => setFilters(f => ({ ...f, centerId: v }))} />
      <FilterSelect label="Category" value={filters.category} options={distinctCategories} onChange={(v) => setFilters(f => ({ ...f, category: v }))} />
      <FilterSelect label="Cuisine" value={filters.cuisine} options={distinctCuisines} onChange={(v) => setFilters(f => ({ ...f, cuisine: v }))} />
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }: { label: string, value: string, options: string[], onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-[13px] font-bold text-[var(--color-text)] py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all cursor-pointer truncate max-w-[140px]"
        >
          <option value="">All</option>
          {options.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-tertiary)]">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
    </div>
  )
}