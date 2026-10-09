import { AlertCircle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NeedsAttention({ centers }: { centers: any[] }) {
  if (!centers || !centers.length) return null

  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden" aria-label="Centers Needing Attention">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-[var(--color-danger)]" />
          <h2 className="text-[14px] font-bold text-[var(--color-text)] uppercase tracking-wider">Needs Attention</h2>
        </div>
        <span className="bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-[11px] font-bold px-2 py-0.5 rounded-full">
          {centers.length} Centers
        </span>
      </div>

      <div className="divide-y divide-[var(--color-border-subtle)]">
        {centers.map(c => (
          <Link key={c.center_id} to={`/centers/${c.center_id}`} className="group flex items-center justify-between p-4 hover:bg-[var(--color-surface-alt)] transition-colors">
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">Center {c.center_id}</span>
              <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">{c.simulated_city} &bull; {c.center_type}</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex flex-col items-end">
                <span className="text-[13px] font-bold tabular-nums text-[var(--color-danger)]">
                  +{c.wow_increase.toFixed(0)}%
                </span>
                <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase">WoW Risk</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--color-border)] group-hover:text-[var(--color-accent)] transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

