import { useAppContext } from '../../context/AppContext'
import { formatCompact } from '../../lib/format'
import { Layers } from 'lucide-react'

export function InventoryScenarios({ data }: { data: any[] }) {
  const { buffer } = useAppContext()
  const totalDemand = data.reduce((s, d) => s + d.predicted_orders, 0)

  const scenarios = [0, 10, 15, 20].map(pct => {
    const prep = totalDemand * (1 + pct / 100)
    return { pct, prep }
  })

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
      <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-[var(--color-border)]/50">
        <Layers className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-bold text-[var(--color-text)] uppercase tracking-wider">Buffer Scenarios</h3>
      </div>
      <div className="space-y-3">
        {scenarios.map(s => {
          const isActive = s.pct === buffer
          return (
            <div key={s.pct} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)]/30' : 'bg-[var(--color-surface-alt)] border-[var(--color-border-subtle)]'}`}>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />
                <span className={`text-[13px] font-bold ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}>+{s.pct}% Buffer</span>
              </div>
              <span className={`text-[13px] font-bold tabular-nums ${isActive ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}>
                {formatCompact(s.prep)} <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] ml-1">target</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}