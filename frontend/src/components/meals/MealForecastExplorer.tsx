import { useState, useMemo } from 'react'
import type { MealAnalysis } from '../../lib/types'
import { formatCompact, formatFull } from '../../lib/format'
import type { MealsFilterState } from '../../pages/Meals'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { Maximize2 } from 'lucide-react'

export function MealForecastExplorer({ meals, bufferPct, filters }: { meals: MealAnalysis[], bufferPct: number, filters: MealsFilterState }) {
  const [selectedMealId, setSelectedMealId] = useState<number | ''>('')
  const navigate = useNavigate()
  
  // Default to the highest volume meal if none selected, but safely handle empty state
  const mealToViewId = selectedMealId || (meals.length > 0 ? [...meals].sort((a,b) => b.predicted_orders - a.predicted_orders)[0].meal_id : null)
  const meal = useMemo(() => meals.find(m => m.meal_id === mealToViewId), [meals, mealToViewId])

  const trajectoryData = useMemo(() => {
    if (!meal) return []
    const data = []
    
    // In this explorer, we only show weeks 146-155 (predicted) since the user explicitly requested it.
    for (const p of meal.weekly_trajectory) {
      if (p.week >= 146 && p.week <= 155) {
        data.push({ week: p.week, predicted: p.predicted_orders, prep: p.predicted_orders * (1 + bufferPct) })
      }
    }
    return data.sort((a, b) => a.week - b.week)
  }, [meal, bufferPct])

  const CustomChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    
    // Find prev week to calc WoW change
    const prevIdx = trajectoryData.findIndex(x => x.week === d.week - 1)
    const prev = prevIdx >= 0 ? trajectoryData[prevIdx] : null
    const change = prev ? d.predicted - prev.predicted : null

    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-hairline)] shadow-sm px-4 py-3 rounded-md min-w-[200px]">
        <div className="font-serif text-[15px] mb-2 border-b border-[var(--color-hairline)] pb-2">Week {d.week}</div>
        
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-[var(--color-ink-secondary)]">Predicted Demand</span>
            <span className="font-medium text-[var(--color-ink)]">{formatFull(d.predicted)}</span>
          </div>
          
          {change !== null && (
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-[var(--color-ink-tertiary)]">WoW Change</span>
              <span className={`font-medium ${change > 0 ? 'text-[var(--color-growth)]' : change < 0 ? 'text-[var(--color-risk)]' : 'text-[var(--color-ink-secondary)]'}`}>
                {change > 0 ? '+' : ''}{formatFull(change)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-[13px] pt-1.5 mt-1 border-t border-[var(--color-hairline)]">
            <span className="text-[var(--color-ink-secondary)]">Prep Req</span>
            <span className="font-medium text-[var(--color-caution)]">{formatFull(d.prep)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-hairline)] bg-white rounded-lg p-6 flex flex-col relative h-[400px]">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-[16px] font-serif mb-1">10-Week Forecast Explorer</h2>
          <p className="text-[13px] text-[var(--color-ink-secondary)]">
            {filters.center_id ? `Demand trajectory at Center ${filters.center_id}` : 'Network-wide demand trajectory'}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] h-[32px]">
          <span className="px-3 text-[var(--color-ink-secondary)] font-medium border-r border-[var(--color-hairline)] h-full flex items-center">
            Inspect Meal
          </span>
          <select
            value={selectedMealId}
            onChange={(e) => setSelectedMealId(e.target.value ? Number(e.target.value) : '')}
            className="bg-transparent pl-3 pr-8 h-full outline-none font-semibold cursor-pointer appearance-none truncate max-w-[160px]"
            style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
          >
            {selectedMealId === '' && <option value="">Auto (Top Meal)</option>}
            {meals.map(m => (
              <option key={m.meal_id} value={m.meal_id}>Meal {m.meal_id} ({m.category})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        {trajectoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(20,19,15,0.06)" />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} width={50} />
              <Tooltip content={<CustomChartTooltip />} cursor={{ stroke: 'rgba(20,19,15,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              
              <Area type="monotone" dataKey="predicted" stroke="var(--color-brand)" strokeWidth={2} fillOpacity={0.1} fill="var(--color-brand)" activeDot={{ r: 4, fill: 'var(--color-brand)', stroke: 'white', strokeWidth: 2 }} />
              {bufferPct > 0 && (
                <Area type="monotone" dataKey="prep" stroke="var(--color-caution)" strokeWidth={2} fill="none" strokeDasharray="4 4" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[13px] text-[var(--color-ink-secondary)]">
            No data available for the selected parameters.
          </div>
        )}
      </div>

      {meal && (
        <button 
          onClick={() => navigate(`/meals/${meal.meal_id}`)}
          className="absolute top-6 right-6 flex items-center justify-center w-8 h-8 rounded-md bg-[rgba(20,19,15,0.03)] hover:bg-[rgba(20,19,15,0.06)] text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)] transition-colors cursor-pointer border border-[var(--color-hairline)]"
          title="Open Full Meal Detail"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
