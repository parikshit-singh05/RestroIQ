import type { CenterAnalysis } from '../../lib/types'
import { formatCompact, formatFull } from '../../lib/format'

export function CentersSummary({ centers, bufferPct }: { centers: CenterAnalysis[], bufferPct: number }) {
  const count = centers.length
  const totalPredicted = centers.reduce((sum, c) => sum + c.predicted_orders, 0)
  const totalPrep = totalPredicted * (1 + bufferPct)

  const topCenter = count > 0 ? [...centers].sort((a, b) => b.predicted_orders - a.predicted_orders)[0] : null

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between border-y border-[var(--color-hairline)] py-5 mb-12">
      <div className="flex-1 min-w-0 pr-6 border-b md:border-b-0 md:border-r border-[var(--color-hairline)] mb-4 md:mb-0 pb-4 md:pb-0">
        <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Centers in View</p>
        <p className="text-[24px] font-serif tracking-tight text-[var(--color-ink)]">{count}</p>
      </div>

      <div className="flex-1 min-w-0 px-0 md:px-6 border-b md:border-b-0 md:border-r border-[var(--color-hairline)] mb-4 md:mb-0 pb-4 md:pb-0">
        <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Predicted Orders</p>
        <p className="text-[24px] font-serif tracking-tight text-[var(--color-ink)]" title={formatFull(totalPredicted)}>
          {formatCompact(totalPredicted)}
        </p>
      </div>

      <div className="flex-1 min-w-0 px-0 md:px-6 border-b md:border-b-0 md:border-r border-[var(--color-hairline)] mb-4 md:mb-0 pb-4 md:pb-0">
        <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Top Forecast Center</p>
        <p className="text-[24px] font-serif tracking-tight text-[var(--color-ink)] truncate">
          {topCenter ? `Center ${topCenter.center_id}` : '--'}
        </p>
      </div>

      <div className="flex-1 min-w-0 md:pl-6">
        <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Recommended Prep</p>
        <p className="text-[24px] font-serif tracking-tight text-[var(--color-ink)]" title={formatFull(totalPrep)}>
          {formatCompact(totalPrep)}
        </p>
      </div>
    </div>
  )
}
