import type { MealAnalysis } from '../../lib/types'
import { formatCompact, formatFull } from '../../lib/format'

export function MealsSummary({ meals, totalDemand, bufferPct, topMeal }: { meals: MealAnalysis[], totalDemand: number, bufferPct: number, topMeal: MealAnalysis | null }) {
  const count = meals.length
  const totalPrep = totalDemand * (1 + bufferPct)

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between border-y border-[var(--color-hairline)] py-5 mb-12">
      <div className="flex-1 min-w-0 pr-6 border-b md:border-b-0 md:border-r border-[var(--color-hairline)] mb-4 md:mb-0 pb-4 md:pb-0">
        <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Meals in View</p>
        <p className="text-[24px] font-serif tracking-tight text-[var(--color-ink)]">{count}</p>
      </div>

      <div className="flex-1 min-w-0 px-0 md:px-6 border-b md:border-b-0 md:border-r border-[var(--color-hairline)] mb-4 md:mb-0 pb-4 md:pb-0">
        <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Predicted Demand</p>
        <p className="text-[24px] font-serif tracking-tight text-[var(--color-ink)]" title={formatFull(totalDemand)}>
          {formatCompact(totalDemand)}
        </p>
      </div>

      <div className="flex-1 min-w-0 px-0 md:px-6 border-b md:border-b-0 md:border-r border-[var(--color-hairline)] mb-4 md:mb-0 pb-4 md:pb-0">
        <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Top Forecast Meal</p>
        <div className="truncate">
          <span className="text-[24px] font-serif tracking-tight text-[var(--color-ink)] mr-2">
            {topMeal ? `Meal ${topMeal.meal_id}` : '--'}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0 md:pl-6">
        <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Recommended Prep</p>
        <p className="text-[24px] font-serif tracking-tight text-[var(--color-caution)]" title={formatFull(totalPrep)}>
          {formatCompact(totalPrep)}
        </p>
      </div>
    </div>
  )
}
