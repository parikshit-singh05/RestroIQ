import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Focus, ChevronRight } from 'lucide-react'
import type { InventoryRecommendation, CenterInfo, MealInfo } from '../../lib/types'
import { useAppContext } from '../../context/AppContext'

interface Props {
  inventory: InventoryRecommendation[]
  centers: CenterInfo[]
  meals: MealInfo[]
}

function getSurplusKey(buffer: number): keyof InventoryRecommendation {
  if (buffer === 10) return 'potential_surplus_10pct'
  if (buffer === 15) return 'potential_surplus_15pct'
  if (buffer === 20) return 'potential_surplus_20pct'
  return 'potential_surplus_10pct'
}

function getPrepKey(buffer: number): keyof InventoryRecommendation {
  if (buffer === 0) return 'prep_0pct'
  if (buffer === 10) return 'prep_10pct'
  if (buffer === 15) return 'prep_15pct'
  if (buffer === 20) return 'prep_20pct'
  return 'prep_10pct'
}

export function NeedsAttention({ inventory, centers, meals }: Props) {
  const { buffer } = useAppContext()

  const centerMap = useMemo(() => {
    const m = new Map<number, CenterInfo>()
    centers.forEach(c => m.set(c.center_id, c))
    return m
  }, [centers])

  const mealMap = useMemo(() => {
    const m = new Map<number, MealInfo>()
    meals.forEach(ml => m.set(ml.meal_id, ml))
    return m
  }, [meals])

  // Always rank by predicted orders since surplus/prep are strictly proportional
  const topItems = useMemo(() => {
    return [...inventory]
      .sort((a, b) => b.predicted_orders - a.predicted_orders)
      .slice(0, 8)
  }, [inventory])

  if (!topItems.length) return null

  const surplusKey = getSurplusKey(buffer)
  const prepKey = getPrepKey(buffer)

  return (
    <section aria-label="High volume allocations">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Focus className="w-4 h-4 text-[var(--color-brand)]" />
          <h2 className="text-[15px] font-semibold tracking-tight">Needs attention</h2>
          <span className="text-[12px] text-[var(--color-ink-secondary)] ml-2">
            Highest predicted volume allocations
          </span>
        </div>
        <Link to="/inventory" className="text-[12px] font-medium text-[var(--color-brand)] hover:underline flex items-center">
          View all <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </Link>
      </div>

      <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[rgba(20,19,15,0.02)]">
              <th className="font-medium text-[var(--color-ink-secondary)] py-2.5 px-4 w-8">#</th>
              <th className="font-medium text-[var(--color-ink-secondary)] py-2.5 px-4">Location & Meal</th>
              <th className="font-medium text-[var(--color-ink-secondary)] py-2.5 px-4 text-right">Predicted</th>
              {buffer > 0 && (
                <>
                  <th className="font-medium text-[var(--color-ink-secondary)] py-2.5 px-4 text-right">Prep ({buffer}%)</th>
                  <th className="font-medium text-[var(--color-brand)] py-2.5 px-4 text-right">Buffer vol.</th>
                </>
              )}
              <th className="font-medium text-[var(--color-ink-secondary)] py-2.5 px-4 w-32">Priority basis</th>
              <th className="font-medium text-[var(--color-ink-secondary)] py-2.5 px-4 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {topItems.map((item, i) => {
              const center = centerMap.get(item.center_id)
              const meal = mealMap.get(item.meal_id)
              const surplusVal = buffer > 0 ? (item[surplusKey] as number) : 0
              const prepVal = item[prepKey] as number

              return (
                <tr
                  key={`${item.week}-${item.center_id}-${item.meal_id}`}
                  className="hover:bg-[rgba(20,19,15,0.015)] transition-colors group cursor-pointer"
                >
                  <td className="py-3 px-4 text-[var(--color-ink-secondary)] tabular-nums text-[12px]">
                    {i + 1}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-[var(--color-ink)] flex items-baseline">
                      Center {item.center_id}
                      {center && <span className="font-normal text-[var(--color-ink-secondary)] ml-1.5"> &middot; {center.simulated_city}</span>}
                    </div>
                    <div className="text-[12px] text-[var(--color-ink-secondary)]">
                      Meal {item.meal_id}
                      {meal && <span> &middot; {meal.category} &middot; {meal.cuisine}</span>}
                      <span className="ml-1.5 text-[11px] opacity-60">W{item.week}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium">
                    {Math.round(item.predicted_orders).toLocaleString('en-IN')}
                  </td>
                  {buffer > 0 && (
                    <>
                      <td className="py-3 px-4 text-right tabular-nums text-[var(--color-ink-secondary)]">
                        {Math.round(prepVal).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-[var(--color-brand)]">
                        +{Math.round(surplusVal).toLocaleString('en-IN')}
                      </td>
                    </>
                  )}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[rgba(20,19,15,0.04)] text-[10px] font-medium text-[var(--color-ink-secondary)] leading-tight uppercase tracking-wide">
                      Highest forecast volume
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--color-ink-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}