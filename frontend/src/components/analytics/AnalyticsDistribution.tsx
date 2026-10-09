import { useState } from 'react'
import { formatCompact } from '../../lib/format'

export function AnalyticsDistribution({ dist }: { dist: any }) {
  const [active, setActive] = useState<'category'|'cuisine'|'center'|'city'>('category')
  
  const data = dist[active] || []
  if (!data.length) return null
  
  const max = Math.max(...data.map((d: any) => d.value))
  const total = dist.total_demand || data.reduce((s: number, d: any) => s + d.value, 0)

  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 mb-8 flex-1" aria-label="Demand Distribution">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Demand Concentration</h3>
          <p className="text-[13px] text-[var(--color-ink-secondary)] mt-0.5">
            Distribution of observed historical demand.
          </p>
        </div>
        <div className="flex bg-[rgba(20,19,15,0.03)] p-1 rounded-md mt-4 md:mt-0">
          {['category', 'cuisine', 'center', 'city'].map(t => (
            <button
              key={t}
              onClick={() => setActive(t as any)}
              className={`px-3 py-1 text-[12px] font-medium rounded capitalize transition-all ${active === t ? 'bg-white shadow-sm text-[var(--color-ink)]' : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-3 h-[240px] overflow-y-auto custom-scrollbar pr-4">
        {data.map((d: any) => (
          <div key={d.name} className="relative">
            <div className="flex justify-between text-[13px] mb-1">
              <span className="font-medium text-[var(--color-ink)] truncate max-w-[200px]" title={String(d.name)}>{d.name}</span>
              <span className="tabular-nums text-[var(--color-ink-secondary)]" title={d.value.toLocaleString('en-IN')}>
                {formatCompact(d.value)} <span className="text-[10px] ml-1 opacity-60">({((d.value/total)*100).toFixed(1)}%)</span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-[rgba(20,19,15,0.04)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-ink)] rounded-full transition-all duration-500" style={{ width: `${(d.value/max)*100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
