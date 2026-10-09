import { useState, useMemo } from 'react'
import type { MealAnalysis } from '../../lib/types'
import { formatCompact, formatFull } from '../../lib/format'
import type { MealsFilterState } from '../../pages/Meals'

export function MealsCategoryAnalysis({ meals, totalDemand, filters, setFilters }: { meals: MealAnalysis[], totalDemand: number, filters: MealsFilterState, setFilters: (f: MealsFilterState) => void }) {
  const [mode, setMode] = useState<'category' | 'cuisine'>('category')

  const stats = useMemo(() => {
    const map = new Map<string, { predicted: number, count: number }>()
    meals.forEach(m => {
      const key = mode === 'category' ? m.category : m.cuisine
      const cur = map.get(key) || { predicted: 0, count: 0 }
      cur.predicted += m.predicted_orders
      cur.count += 1
      map.set(key, cur)
    })
    
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      predicted: data.predicted,
      count: data.count,
      share: totalDemand > 0 ? (data.predicted / totalDemand) * 100 : 0
    })).sort((a, b) => b.predicted - a.predicted)
  }, [meals, mode, totalDemand])

  const topItem = stats.length > 0 ? stats[0] : null
  const insight = topItem && totalDemand > 0
    ? `${topItem.name} represents ${topItem.share.toFixed(1)}% of predicted demand in the current view.`
    : 'No demand in current view.'

  const handleSelect = (name: string) => {
    if (mode === 'category') {
      setFilters({ ...filters, category: filters.category === name ? '' : name })
    } else {
      setFilters({ ...filters, cuisine: filters.cuisine === name ? '' : name })
    }
  }

  const activeFilter = mode === 'category' ? filters.category : filters.cuisine

  return (
    <div className="border border-[var(--color-hairline)] bg-[rgba(20,19,15,0.02)] rounded-lg p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
        <h2 className="text-[16px] font-serif">Composition</h2>
        <div className="flex items-center bg-white p-0.5 rounded-sm border border-[var(--color-hairline)]">
          <button 
            onClick={() => setMode('category')}
            className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${mode === 'category' ? 'bg-[var(--color-ink)] text-white shadow-sm' : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]'}`}
          >
            Category
          </button>
          <button 
            onClick={() => setMode('cuisine')}
            className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${mode === 'cuisine' ? 'bg-[var(--color-ink)] text-white shadow-sm' : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]'}`}
          >
            Cuisine
          </button>
        </div>
      </div>
      
      <p className="text-[13px] text-[var(--color-ink-secondary)] mb-6 pb-4 border-b border-[var(--color-hairline)] leading-relaxed">
        {insight}
      </p>

      <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar">
        <div className="space-y-2">
          {stats.map((s) => {
            const isActive = activeFilter === s.name
            return (
              <div 
                key={s.name}
                onClick={() => handleSelect(s.name)}
                className={`group flex items-center justify-between p-3.5 rounded-md cursor-pointer transition-all ${isActive ? 'bg-white shadow-sm border border-[var(--color-brand)] ring-1 ring-[var(--color-brand)] ring-opacity-20' : 'bg-transparent hover:bg-white border border-transparent hover:border-[var(--color-hairline)] hover:shadow-sm'}`}
              >
                <div className="min-w-0 pr-4">
                  <div className={`text-[13.5px] font-medium truncate transition-colors mb-1 ${isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink)] group-hover:text-[var(--color-brand)]'}`}>
                    {s.name}
                  </div>
                  <div className="text-[11px] font-medium text-[var(--color-ink-secondary)] uppercase tracking-wider">
                    {s.count} {s.count === 1 ? 'meal' : 'meals'}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap pl-3 border-l border-[var(--color-hairline)]">
                  <div className="text-[14px] font-medium text-[var(--color-ink)] mb-1 tracking-tight" title={formatFull(s.predicted)}>
                    {formatCompact(s.predicted)}
                  </div>
                  <div className={`text-[12px] font-mono font-medium ${isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink-secondary)]'}`}>
                    {s.share.toFixed(1)}%
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
