import { Search, X } from 'lucide-react'

export interface FilterState {
  week: string
  city: string
  centerId: string
  category: string
  cuisine: string
  search: string
}

interface Props {
  filters: FilterState
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>
  distinctWeeks: string[]
  distinctCities: string[]
  distinctCenters: string[]
  distinctCategories: string[]
  distinctCuisines: string[]
}

export function ForecastFilters({ filters, setFilters, distinctWeeks, distinctCities, distinctCenters, distinctCategories, distinctCuisines }: Props) {
  
  const hasActiveFilters = Object.values(filters).some(v => v !== '')
  const clearFilters = () => setFilters({ week: '', city: '', centerId: '', category: '', cuisine: '', search: '' })

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 lg:p-5 shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 lg:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] font-medium bg-[var(--color-surface-alt)] text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
            placeholder="Search by Center ID or Meal ID..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
          {filters.search && (
            <button onClick={() => setFilters(prev => ({ ...prev, search: '' }))} className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        
        {/* Clear all */}
        {hasActiveFilters && (
          <button 
            onClick={clearFilters}
            className="hidden lg:flex items-center px-3 py-2 text-[12px] font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-colors ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <FilterSelect label="Week" value={filters.week} options={distinctWeeks} onChange={(v) => setFilters(prev => ({ ...prev, week: v }))} placeholder="All Weeks" />
        <FilterSelect label="City" value={filters.city} options={distinctCities} onChange={(v) => setFilters(prev => ({ ...prev, city: v, centerId: '' }))} placeholder="All Cities" />
        <FilterSelect label="Center" value={filters.centerId} options={distinctCenters} onChange={(v) => setFilters(prev => ({ ...prev, centerId: v }))} placeholder="All Centers" />
        <FilterSelect label="Category" value={filters.category} options={distinctCategories} onChange={(v) => setFilters(prev => ({ ...prev, category: v }))} placeholder="All Categories" />
        <FilterSelect label="Cuisine" value={filters.cuisine} options={distinctCuisines} onChange={(v) => setFilters(prev => ({ ...prev, cuisine: v }))} placeholder="All Cuisines" />
      </div>
      
      {hasActiveFilters && (
        <button 
          onClick={clearFilters}
          className="lg:hidden w-full mt-2 py-2 text-[12px] font-bold text-[var(--color-text-secondary)] bg-[var(--color-surface-alt)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  )
}

function FilterSelect({ label, value, options, onChange, placeholder }: { label: string, value: string, options: string[], onChange: (v: string) => void, placeholder: string }) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-[13px] font-medium text-[var(--color-text)] py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {options.map(o => (
            <option key={o} value={o}>{label === 'Week' ? `Week ${o}` : o}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-tertiary)]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
    </div>
  )
}