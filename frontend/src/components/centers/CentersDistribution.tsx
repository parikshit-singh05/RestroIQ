import { useMemo } from 'react'

export function CentersDistribution({ data }: { data: any[] }) {
  const chartData = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach(d => {
      map.set(d.simulated_city, (map.get(d.simulated_city) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a,b) => b.count - a.count)
  }, [data])

  if (!chartData.length) return null
  const max = Math.max(...chartData.map(d => d.count))

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm p-6" aria-label="City Distribution">
      <h3 className="text-[15px] font-heading font-bold tracking-tight text-[var(--color-text)] mb-6">Geographic Distribution</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
        {chartData.map(d => (
          <div key={d.name} className="relative group">
            <div className="flex justify-between text-[13px] mb-1.5">
              <span className="font-bold text-[var(--color-text)]">{d.name}</span>
              <span className="tabular-nums font-bold text-[var(--color-text-secondary)]">{d.count} locations</span>
            </div>
            <div className="h-2 w-full bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500 opacity-90 group-hover:opacity-100" style={{ width: `${(d.count/max)*100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}