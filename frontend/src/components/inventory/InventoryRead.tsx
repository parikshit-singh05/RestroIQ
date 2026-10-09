import { useMemo } from 'react'
import type { ForecastSummary, InventoryRecommendation } from '../../lib/types'
import { useAppContext } from '../../context/AppContext'
import { formatCompact } from '../../lib/format'
import { computePeakWeek } from '../../lib/computations'

interface Props {
  summary: ForecastSummary[]
  detailed: InventoryRecommendation[]
}

export function InventoryRead({ summary, detailed }: Props) {
  const { buffer } = useAppContext()

  const { headline, opsRead } = useMemo(() => {
    if (!summary.length || !detailed.length) return { headline: '', opsRead: [] }
    
    const totalDemand = summary.reduce((sum, s) => sum + s.total_predicted_orders, 0)
    const totalPrep = totalDemand * (1 + buffer / 100)
    
    let headline = ''
    if (buffer > 0) {
      headline = `At a ${buffer}% buffer, the 10-week plan calls for ${formatCompact(totalPrep)} prepared orders.`
    } else {
      headline = `The baseline 10-week preparation plan strictly matches ${formatCompact(totalPrep)} predicted orders.`
    }

    const peak = computePeakWeek(summary)
    
    let topMeal = { id: 0, prep: 0 }
    const mealVols = new Map<number, number>()
    
    detailed.forEach(d => {
      const p = d.predicted_orders * (1 + buffer / 100)
      const cur = (mealVols.get(d.meal_id) || 0) + p
      mealVols.set(d.meal_id, cur)
      if (cur > topMeal.prep) topMeal = { id: d.meal_id, prep: cur }
    })

    const opsRead = [
      `Week ${peak.week} requires the highest preparation volume across the planning horizon.`,
      `Meal ${topMeal.id} contributes the largest preparation requirement in the current active week.`,
      `Prioritize preparation capacity around the highest-volume weeks and center/meal combinations.`
    ]

    return { headline, opsRead }
  }, [summary, detailed, buffer])

  if (!summary.length) return null

  return (
    <div className="mb-10 max-w-[800px]" aria-label="Inventory Read">
      <h2 className="font-serif text-[28px] leading-[1.25] tracking-tight text-[var(--color-ink)] mb-4">
        {headline}
      </h2>
      <div className="bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-lg p-5">
        <h4 className="text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider mb-3">
          Operational Read & What To Do
        </h4>
        <ul className="space-y-2">
          {opsRead.map((read, i) => (
            <li key={i} className="flex items-start space-x-3 text-[14px] text-[var(--color-ink)] leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] mt-[8px] flex-shrink-0" />
              <span>{read}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
