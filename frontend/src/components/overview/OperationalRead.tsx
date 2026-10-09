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
    <section aria-label="Operational observations">
      <div className="flex items-center space-x-2 mb-4">
        <Activity className="w-4 h-4 text-[var(--color-ink-secondary)]" />
        <h2 className="text-[15px] font-semibold tracking-tight">Operational read</h2>
      </div>

      <div className="space-y-3">
        {observations.map((obs, i) => (
          <div
            key={i}
            className="flex items-start space-x-3 text-[13px] text-[var(--color-ink-secondary)] leading-relaxed"
          >
            <span className="w-1 h-1 rounded-full bg-[var(--color-ink-secondary)] mt-[7px] flex-shrink-0 opacity-50" />
            <span>{obs}</span>
          </div>
        ))}
      </div>
    </section>
  )
}