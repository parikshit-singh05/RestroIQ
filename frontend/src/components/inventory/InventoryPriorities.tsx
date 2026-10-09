import { useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { formatCompact } from '../../lib/format'
import { AlertCircle, Target } from 'lucide-react'

export function InventoryPriorities({ data }: { data: any[] }) {
  const { buffer } = useAppContext()
  const [view, setView] = useState<'meals'|'centers'>('meals')

  const aggregated = (() => {
    const map = new Map<string, any>()
    data.forEach(d => {
      const key = view === 'meals' ? `Meal ${d.meal_id}` : `Center ${d.center_id}`
      const existing = map.get(key) || { name: key, demand: 0, count: 0, sublabel: view === 'meals' ? d.category : d.simulated_city }
      existing.demand += d.predicted_orders
      existing.count += 1
      map.set(key, existing)
    })
    return Array.from(map.values()).sort((a,b) => b.demand - a.demand).slice(0, 10)
  })()

  if (!aggregated.length) return null

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-[var(--color-accent)]" />
          <h3 className="text-[15px] font-heading font-bold tracking-tight text-[var(--color-text)]">Action Priorities</h3>
        </div>
        <div className="flex bg-[var(--color-surface-alt)] p-1 rounded-lg border border-[var(--color-border)]">
          <button
            onClick={() => setView('meals')}
            className={`px-3 py-1.5 text-[12px] font-bold rounded-md transition-all ${view === 'meals' ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
          >
            By Meal
          </button>
          <button
            onClick={() => setView('centers')}
            className={`px-3 py-1.5 text-[12px] font-bold rounded-md transition-all ${view === 'centers' ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}
          >
            By Center
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border-subtle)] text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
              <th className="py-3 px-5 font-bold">{view === 'meals' ? 'Meal Item' : 'Center'}</th>
              <th className="py-3 px-5 text-right font-bold">Predicted Demand</th>
              <th className="py-3 px-5 text-right font-bold">Prep Target <span className="text-[var(--color-success)] ml-1">+{buffer}%</span></th>
              <th className="py-3 px-5 text-right font-bold hidden sm:table-cell">Risk Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {aggregated.map((item, i) => {
              const prep = item.demand * (1 + buffer/100)
              const isHigh = i < 3
              return (
                <tr key={item.name} className="hover:bg-[var(--color-surface-alt)] transition-colors group">
                  <td className="py-3 px-5">
                    <div className="text-[13px] font-bold text-[var(--color-text)]">{item.name}</div>
                    <div className="text-[11px] font-medium text-[var(--color-text-tertiary)] mt-0.5">{item.sublabel}</div>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="text-[13px] font-bold tabular-nums text-[var(--color-text)]">{formatCompact(item.demand)}</div>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="text-[13px] font-bold tabular-nums text-[var(--color-success)]">{formatCompact(prep)}</div>
                  </td>
                  <td className="py-3 px-5 text-right hidden sm:table-cell">
                    {isHigh ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-[var(--color-danger)] bg-[var(--color-danger-bg)] px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" />
                        <span>High Volume</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Normal</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}