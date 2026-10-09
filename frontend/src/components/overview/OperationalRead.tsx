import type { ForecastSummary } from '../../lib/types'
import { useAppContext } from '../../context/AppContext'
import { generateObservations, computeTotalForecast } from '../../lib/computations'
import { Activity } from 'lucide-react'

interface Props {
  summary: ForecastSummary[]
}

export function OperationalRead({ summary }: Props) {
  const { buffer } = useAppContext()
  if (!summary.length) return null

  const total = computeTotalForecast(summary)
  const observations = generateObservations(summary, total, buffer)

  return (
    <section className="bg-[var(--color-surface-alt)] rounded-xl p-5 border border-[var(--color-border-subtle)]" aria-label="Operational observations">
      <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-[var(--color-border)]/50">
        <Activity className="w-4 h-4 text-[var(--color-accent)]" />
        <h2 className="text-[14px] font-bold text-[var(--color-text)] uppercase tracking-wider">Operational Read</h2>
      </div>

      <div className="space-y-3.5">
        {observations.map((obs, i) => (
          <div
            key={i}
            className="flex items-start text-[13px] font-medium text-[var(--color-text-secondary)] leading-relaxed"
          >
            <span className="text-[var(--color-accent)] mr-2.5 mt-0.5 opacity-70">•</span>
            <span>{obs}</span>
          </div>
        ))}
      </div>
    </section>
  )
}