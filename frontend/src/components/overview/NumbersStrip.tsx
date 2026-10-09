import type { ForecastSummary } from '../../lib/types'
import { computeAverageForecast, computeTotalForecast, computePreparation, computeSurplus } from '../../lib/computations'
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
      className="mb-10 grid grid-cols-4 border-y border-[var(--color-hairline)] divide-x divide-[var(--color-hairline)]"
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
      />
      <Metric
        label="Buffer volume"
        value={formatCompact(surplus)}
        sublabel="uncommitted orders"
        accent="brand"
      />
    </section>
  )
}

function Metric({ label, value, sublabel, accent }: {
  label: string
  value: string
  sublabel: string
  accent?: 'peak' | 'caution' | 'brand'
}) {
  const accentClass = accent === 'peak'
    ? 'text-[var(--color-peak)]'
    : accent === 'caution'
    ? 'text-[var(--color-caution)]'
    : accent === 'brand'
    ? 'text-[var(--color-brand)]'
    : 'text-[var(--color-ink)]'

  return (
    <div className="py-5 px-6">
      <p className="text-[11px] font-medium text-[var(--color-ink-secondary)] uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-[28px] font-semibold tabular-nums tracking-tight leading-none mb-1 transition-all duration-300 ${accentClass}`}>
        {value}
      </p>
      <p className="text-[12px] text-[var(--color-ink-secondary)]">{sublabel}</p>
    </div>
  )
}