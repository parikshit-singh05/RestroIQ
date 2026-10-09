import { useAppContext } from '../../context/AppContext'
import { formatCompact } from '../../lib/format'
import type { ForecastSummary } from '../../lib/types'
import { computePeakWeek } from '../../lib/computations'

interface Props {
  summary: ForecastSummary[]
}

export function InventoryStrip({ summary }: Props) {
  const { buffer } = useAppContext()
  if (!summary.length) return null

  const totalDemand = summary.reduce((sum, s) => sum + s.total_predicted_orders, 0)
  const totalPrep = totalDemand * (1 + buffer / 100)
  const extraBuffer = totalPrep - totalDemand
  const peak = computePeakWeek(summary)
  const peakPrep = peak.value * (1 + buffer / 100)

  return (
    <div className="flex flex-col md:flex-row items-center justify-between border-y border-[var(--color-hairline)] py-5 mb-8">
      <StripItem label="Forecast Demand" value={formatCompact(totalDemand)} sub="10-week horizon" />
      <StripDivider />
      <StripItem label="Recommended Preparation" value={formatCompact(totalPrep)} sub={`${buffer}% buffer`} highlight />
      <StripDivider />
      <StripItem label="Buffer Volume" value={formatCompact(extraBuffer)} sub="additional planned prep" />
      <StripDivider />
      <StripItem label="Peak Preparation" value={`W${peak.week}`} sub={`${formatCompact(peakPrep)} orders`} />
    </div>
  )
}

function StripItem({ label, value, sub, highlight }: { label: string, value: string, sub: string, highlight?: boolean }) {
  return (
    <div className="flex-1 text-center py-2">
      <div className="text-[10px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-2xl font-serif tabular-nums tracking-tight mb-0.5 ${highlight ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink)]'}`}>
        {value}
      </div>
      <div className="text-[12px] text-[var(--color-ink-secondary)]">
        {sub}
      </div>
    </div>
  )
}

function StripDivider() {
  return <div className="hidden md:block w-px h-12 bg-[var(--color-hairline)]" />
}
