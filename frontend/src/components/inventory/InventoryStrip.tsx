import { useAppContext } from '../../context/AppContext'
import { formatCompact } from '../../lib/format'

export function InventoryStrip({ data }: { data: any[] }) {
  const { buffer } = useAppContext()
  
  const totalDemand = data.reduce((s, d) => s + d.predicted_orders, 0)
  const totalPrep = totalDemand * (1 + buffer / 100)
  const surplus = totalPrep - totalDemand

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Predicted Demand</p>
        <p className="text-[28px] font-heading font-bold tabular-nums text-[var(--color-text)] leading-none">{formatCompact(totalDemand)}</p>
      </div>
      <div className="bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-bold text-[var(--color-success)] uppercase tracking-wider mb-2">Prep Target (With Buffer)</p>
        <p className="text-[28px] font-heading font-bold tabular-nums text-[var(--color-success)] leading-none">{formatCompact(totalPrep)}</p>
      </div>
      <div className="bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/20 rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-bold text-[var(--color-accent)] uppercase tracking-wider mb-2">Expected Surplus</p>
        <p className="text-[28px] font-heading font-bold tabular-nums text-[var(--color-accent)] leading-none">{formatCompact(surplus)}</p>
      </div>
    </div>
  )
}