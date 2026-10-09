import type { ForecastSummary } from '../../lib/types'
import { computeTotalForecast, computeAverageForecast, computePreparation, computeSurplus } from '../../lib/computations'
import { formatCompact } from '../../lib/format'
import { useAppContext } from '../../context/AppContext'

interface Props {
  summary: ForecastSummary[]
}

export function NumbersStrip({ summary }: Props) {
  const { buffer } = useAppContext()
  if (!summary.length) return null

  const total = computeTotalForecast(summary)
  const avg = computeAverageForecast(summary)
  const prep = computePreparation(total, buffer)
  const surplus = computeSurplus(total, buffer)

  return (
    <section
      className="mb-10 grid grid-cols-2 lg:grid-cols-4 gap-4"
      aria-label="Key forecast metrics"
    >
      <Metric
        label="10-week forecast"
        value={formatCompact(total)}
        sublabel="total orders"
      />
      <Metric
        label="Avg. weekly demand"
        value={formatCompact(avg)}
        sublabel="orders / week"
      />
      <Metric
        label="Recommended prep"
        value={formatCompact(prep)}
        sublabel={buffer > 0 ? `+${buffer}% buffer` : 'No buffer applied'}
        highlight="success"
      />
      <Metric
        label="Buffer volume"
        value={formatCompact(surplus)}
        sublabel="uncommitted orders"
        highlight="accent"
      />
    </section>
  )
}

function Metric({ label, value, sublabel, highlight }: {
  label: string
  value: string
  sublabel: string
  highlight?: 'accent' | 'success' | 'warning' | 'danger'
}) {
  const highlightColor = highlight === 'accent' ? 'text-[var(--color-accent)]' :
                         highlight === 'success' ? 'text-[var(--color-success)]' :
                         highlight === 'warning' ? 'text-[var(--color-warning)]' :
                         highlight === 'danger' ? 'text-[var(--color-danger)]' :
                         'text-[var(--color-text)]'
                         
  const bgClass = highlight === 'accent' ? 'bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/20' :
                  highlight === 'success' ? 'bg-[var(--color-success-bg)] border border-[var(--color-success)]/20' :
                  'bg-[var(--color-surface)] border border-[var(--color-border)]'

  return (
    <div className={`p-5 lg:p-6 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 ${bgClass}`}>
      <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2.5">{label}</p>
      <p className={`text-[32px] font-heading font-bold tracking-tight leading-none mb-1.5 ${highlightColor}`}>
        {value}
      </p>
      <p className="text-[12px] font-medium text-[var(--color-text-tertiary)]">{sublabel}</p>
    </div>
  )
}