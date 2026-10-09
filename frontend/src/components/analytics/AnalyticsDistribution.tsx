import { useState } from 'react'
import { formatCompact } from '../../lib/format'
import { PieChart as PieIcon } from 'lucide-react'

export function AnalyticsDistribution({ dist }: { dist: any }) {
  const [active, setActive] = useState<'category'|'cuisine'|'center'|'city'>('category')
  const [expanded, setExpanded] = useState(false)
  
  const data = dist[active] || []
  if (!data.length) return null
  
  const max = Math.max(...data.map((d: any) => d.value))
  const total = dist.total_demand || data.reduce((s: number, d: any) => s + d.value, 0)
  
  const displayData = active === 'city' && !expanded ? data.slice(0, 10) : (active === 'city' ? data.slice(0, 15) : data)

  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] p-6 shadow-sm flex flex-col h-full" aria-label="Demand Distribution">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 pb-4 border-b border-[var(--color-border-subtle)] gap-4">
        <div className="flex items-center space-x-2">
          <PieIcon className="w-4 h-4 text-[var(--color-accent)]" />
          <h3 className="text-[16px] font-heading font-bold tracking-tight text-[var(--color-text)]">Demand Concentration</h3>
        </div>
        <div className="flex bg-[var(--color-surface-alt)] p-1 rounded-lg border border-[var(--color-border)]">
          {['category', 'cuisine', 'center', 'city'].map(t => (
            <button
              key={t}
              onClick={() => { setActive(t as any); setExpanded(false); }}
              className={`px-3 py-1.5 text-[12px] font-bold rounded-md capitalize transition-all ${active === t ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-4 flex-grow overflow-y-auto custom-scrollbar pr-2">
        {displayData.map((d: any) => (
          <div key={d.name} className="relative group">
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-[13px] font-bold text-[var(--color-text)] truncate max-w-[200px]" title={String(d.name)}>{d.name}</span>
              <div className="flex items-center space-x-2">
                <span className="tabular-nums font-bold text-[var(--color-text-secondary)] text-[13px]" title={d.value.toLocaleString('en-IN')}>
                  {formatCompact(d.value)}
                </span>
                <span className="text-[11px] font-bold text-[var(--color-accent)] bg-[var(--color-accent-subtle)] px-1.5 rounded">{((d.value/total)*100).toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-2 w-full bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500 opacity-90 group-hover:opacity-100" style={{ width: `${(d.value/max)*100}%` }} />
            </div>
          </div>
        ))}
        {active === 'city' && data.length > 10 && (
          <div className="pt-2 text-center">
            <button onClick={() => setExpanded(!expanded)} className="text-[12px] font-bold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors">
              {expanded ? "Show less" : `Show more (${Math.min(data.length - 10, 5)})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
