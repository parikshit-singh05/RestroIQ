import { Search } from 'lucide-react'

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
  setFilters: (f: FilterState | ((prev: FilterState) => FilterState)) => void
  distinctWeeks: string[]
  distinctCities: string[]
  distinctCenters: string[]
  distinctCategories: string[]
  distinctCuisines: string[]
}

export function InventoryFilters({ filters, setFilters, distinctWeeks, distinctCities, distinctCenters, distinctCategories, distinctCuisines }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 px-10 -mx-10 border-y border-[var(--color-hairline)] mb-8 sticky top-0 z-20 backdrop-blur-md bg-[var(--color-surface)]/95 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Week" value={filters.week} options={distinctWeeks} onChange={(v) => setFilters(f => ({ ...f, week: v }))} />
        <FilterSelect label="City" value={filters.city} options={distinctCities} onChange={(v) => setFilters(f => ({ ...f, city: v, centerId: '' }))} />
        <FilterSelect label="Center" value={filters.centerId} options={distinctCenters} onChange={(v) => setFilters(f => ({ ...f, centerId: v }))} />
        <FilterSelect label="Category" value={filters.category} options={distinctCategories} onChange={(v) => setFilters(f => ({ ...f, category: v }))} />
        <FilterSelect label="Cuisine" value={filters.cuisine} options={distinctCuisines} onChange={(v) => setFilters(f => ({ ...f, cuisine: v }))} />
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-ink-secondary)]" />
        <input
          type="text"
          placeholder="Search center or meal ID..."
          value={filters.search}
          onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
          className="w-full md:w-[220px] pl-8 pr-3 py-1.5 bg-transparent border border-[var(--color-hairline)] rounded-md text-[13px] placeholder:text-[var(--color-ink-secondary)] outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] transition-all"
        />
      </div>
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }: { label: string, value: string, options: string[], onChange: (v: string) => void }) {
  return (
    <div className="flex items-center bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] h-[32px]">
      <span className="px-3 text-[var(--color-ink-secondary)] font-medium border-r border-[var(--color-hairline)] h-full flex items-center">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent pl-3 pr-8 h-full outline-none font-semibold cursor-pointer appearance-none truncate max-w-[140px]"
        style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
      >
        <option value="">All</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}
