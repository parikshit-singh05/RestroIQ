import { formatCompact } from '../../lib/format'
import { TrendingUp, AlertTriangle } from 'lucide-react'

export function ForecastInsights({ data }: { data: any[] }) {
  if (!data.length) return null

  const totalDemand = data.reduce((sum, d) => sum + d.predicted_orders, 0)
  
  // Calculate category concentration
  const catMap = new Map<string, number>()
  data.forEach(d => {
    catMap.set(d.category, (catMap.get(d.category) || 0) + d.predicted_orders)
  })
  let topCat = { name: '', val: 0 }
  catMap.forEach((val, key) => {
    if (val > topCat.val) topCat = { name: key, val }
  })
  const topCatShare = totalDemand > 0 ? (topCat.val / totalDemand) * 100 : 0

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm p-5 h-full">
      <div className="flex items-center space-x-2 mb-6 pb-3 border-b border-[var(--color-border)]/50">
        <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-bold text-[var(--color-text)] uppercase tracking-wider">Filtered Insights</h3>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">Total Volume</p>
          <p className="text-[28px] font-heading font-bold text-[var(--color-text)] tabular-nums leading-none">
            {formatCompact(totalDemand)}
          </p>
          <p className="text-[12px] font-medium text-[var(--color-text-secondary)] mt-1.5">Predicted orders in current view</p>
        </div>

        <div>
          <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">Top Category</p>
          <div className="flex items-baseline space-x-2">
            <p className="text-[20px] font-heading font-bold text-[var(--color-text)] leading-none">{topCat.name || 'N/A'}</p>
            <span className="text-[13px] font-bold text-[var(--color-accent)]">{topCatShare.toFixed(1)}%</span>
          </div>
          <p className="text-[12px] font-medium text-[var(--color-text-secondary)] mt-1.5">Share of filtered demand</p>
        </div>

        <div className="bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20 p-4 rounded-lg mt-6">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
            <p className="text-[12px] font-medium text-[var(--color-warning)] leading-relaxed">
              These insights react instantly to your applied filters. Use them to drill down into specific geographic or menu segments.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
