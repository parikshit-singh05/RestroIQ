import { useMemo } from 'react'

export function CategoryBreakdown({ data }: { data: any[] }) {
  const chartData = useMemo(() => {
    const map = new Map<string, number>()
    data.forEach(d => {
      map.set(d.category, (map.get(d.category) || 0) + d.predicted_orders)
    })
    const arr = Array.from(map.entries())
      .map(([name, orders]) => ({ name, orders }))
      .sort((a,b) => b.orders - a.orders)
    
    const total = arr.reduce((s, d) => s + d.orders, 0)
    return arr.map(d => ({ ...d, pct: total > 0 ? (d.orders / total) * 100 : 0 }))
  }, [data])

  if (!chartData.length) return null

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm p-6" aria-label="Category Breakdown">
      <h3 className="text-[15px] font-heading font-bold text-[var(--color-text)] tracking-tight mb-6">Category Distribution</h3>
      
      <div className="space-y-4">
        {chartData.slice(0, 5).map(d => (
          <div key={d.name} className="relative">
            <div className="flex justify-between text-[13px] mb-1.5">
              <span className="font-bold text-[var(--color-text)]">{d.name}</span>
              <div className="flex items-center space-x-2">
                <span className="tabular-nums font-bold text-[var(--color-text-secondary)]">{d.orders.toLocaleString('en-IN')}</span>
                <span className="text-[11px] font-bold text-[var(--color-accent)] bg-[var(--color-accent-subtle)] px-1.5 rounded">{d.pct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-2 w-full bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500" style={{ width: `${d.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}