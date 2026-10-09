

export function AnalyticsFilters({ filters, setFilters, distinctCities, distinctCenters, distinctCategories, distinctCuisines }: any) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 px-10 -mx-10 border-y border-[var(--color-hairline)] mb-8 sticky top-0 z-20 backdrop-blur-md bg-[var(--color-surface)]/95 shadow-sm">
      <div className="flex items-center space-x-2 bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md px-2 h-[32px]">
        <span className="text-[12px] text-[var(--color-ink-secondary)] font-medium">Weeks</span>
        <input type="number" placeholder="1" min="1" max="145" value={filters.start_week} onChange={e => setFilters((f: any) => ({ ...f, start_week: e.target.value }))} className="w-12 bg-transparent text-[12px] outline-none text-center font-medium" />
        <span className="text-[12px] text-[var(--color-ink-secondary)]">-</span>
        <input type="number" placeholder="145" min="1" max="145" value={filters.end_week} onChange={e => setFilters((f: any) => ({ ...f, end_week: e.target.value }))} className="w-12 bg-transparent text-[12px] outline-none text-center font-medium" />
      </div>
      <FilterSelect label="City" value={filters.city} options={distinctCities} onChange={(v) => setFilters((f: any) => ({ ...f, city: v, centerId: '' }))} />
      <FilterSelect label="Center" value={filters.centerId} options={distinctCenters} onChange={(v) => setFilters((f: any) => ({ ...f, centerId: v }))} />
      <FilterSelect label="Category" value={filters.category} options={distinctCategories} onChange={(v) => setFilters((f: any) => ({ ...f, category: v }))} />
      <FilterSelect label="Cuisine" value={filters.cuisine} options={distinctCuisines} onChange={(v) => setFilters((f: any) => ({ ...f, cuisine: v }))} />
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
