import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMealsAnalysis } from '../lib/api'
import { useAppContext } from '../context/AppContext'
import { AlertCircle, ArrowLeft, Tag, Utensils, MapPin } from 'lucide-react'
import { formatCompact, formatFull } from '../lib/format'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'

export function MealDetail() {
  const { id } = useParams()
  const mealId = Number(id)
  const navigate = useNavigate()
  const { buffer } = useAppContext()
  const bufferPct = buffer / 100

  const { data: meals = [], isLoading, isError } = useQuery({
    queryKey: ['meals_analysis'],
    queryFn: () => getMealsAnalysis()
  })

  const meal = useMemo(() => meals.find(m => m.meal_id === mealId), [meals, mealId])

  const trajectoryData = useMemo(() => {
    if (!meal) return []
    const data = []
    for (const h of meal.historical_trajectory) {
      data.push({ week: h.week, actual: h.num_orders, predicted: null, prep: null, type: 'actual' })
    }
    for (const p of meal.weekly_trajectory) {
      data.push({ week: p.week, actual: null, predicted: p.predicted_orders, prep: p.predicted_orders * (1 + bufferPct), type: 'predicted' })
    }
    return data
  }, [meal, bufferPct])

  const prepProfile = useMemo(() => {
    if (!meal) return null
    let max = -1, min = Infinity, prev = -1, maxW = -1, minW = -1, maxInc = -1
    meal.weekly_trajectory.forEach((w) => {
      const p = w.predicted_orders * (1 + bufferPct)
      if (p > max) { max = p; maxW = w.week }
      if (p < min) { min = p; minW = w.week }
      if (prev !== -1) {
        const inc = p - prev
        if (inc > maxInc) maxInc = inc
      }
      prev = p
    })
    return { max, min, maxW, minW, maxInc }
  }, [meal, bufferPct])

  if (isLoading) {
    return (
      <div className="max-w-[1120px] mx-auto pb-16 pt-8 animate-pulse">
        <div className="h-6 w-24 bg-black/5 mb-8 rounded"></div>
        <div className="h-12 w-1/3 bg-black/5 mb-4 rounded"></div>
        <div className="h-4 w-1/4 bg-black/5 mb-12 rounded"></div>
      </div>
    )
  }

  if (isError || !meal) {
    return (
      <div className="max-w-[1120px] mx-auto flex flex-col items-center justify-center py-24">
        <AlertCircle className="w-10 h-10 text-[var(--color-risk)] mb-4" />
        <h2 className="text-lg font-semibold mb-2">Meal Not Found</h2>
        <button onClick={() => navigate('/meals')} className="text-[13px] font-medium text-[var(--color-brand)] mt-2 cursor-pointer">
          Return to Meals Directory
        </button>
      </div>
    )
  }

  const prep = meal.predicted_orders * (1 + bufferPct)
  const bufferVol = prep - meal.predicted_orders
  const numCenters = meal.center_contributions.length

  const CustomChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-hairline)] shadow-sm px-4 py-3 rounded-md min-w-[180px]">
        <div className="font-serif text-[15px] mb-2 border-b border-[var(--color-hairline)] pb-2">Week {d.week}</div>
        {d.actual !== null && (
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-[var(--color-ink-secondary)]">Actual Orders</span>
            <span className="font-medium">{formatFull(d.actual)}</span>
          </div>
        )}
        {d.predicted !== null && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-[var(--color-ink-secondary)]">Predicted Demand</span>
              <span className="font-medium text-[var(--color-ink)]">{formatFull(d.predicted)}</span>
            </div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-[var(--color-ink-secondary)]">Preparation Req</span>
              <span className="font-medium text-[var(--color-caution)]">{formatFull(d.prep)}</span>
            </div>
            <div className="flex justify-between items-center text-[12px] pt-1 mt-1 border-t border-[var(--color-hairline)]">
              <span className="text-[var(--color-ink-tertiary)]">Buffer Volume</span>
              <span className="text-[var(--color-ink-secondary)] font-medium">+{formatFull(d.prep - d.predicted)}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-[1120px] mx-auto pb-16 pt-8">
      <button 
        onClick={() => navigate('/meals')}
        className="flex items-center space-x-2 text-[13px] font-medium text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)] transition-colors mb-8 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Meal Directory</span>
      </button>

      {/* A. Meal Identity */}
      <header className="mb-10">
        <h1 className="font-serif text-[32px] leading-[1.2] tracking-tight text-[var(--color-ink)] mb-3">
          Meal {meal.meal_id}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-[13px] text-[var(--color-ink-secondary)]">
          <div className="flex items-center space-x-1.5">
            <Tag className="w-4 h-4" />
            <span>{meal.category}</span>
          </div>
          <div className="flex items-center space-x-1.5 border-l border-[var(--color-hairline)] pl-4">
            <Utensils className="w-4 h-4" />
            <span>{meal.cuisine}</span>
          </div>
          <div className="border-l border-[var(--color-hairline)] pl-4">
            Available at {numCenters} centers
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-ink-tertiary)] mt-3 italic">
          Network-wide forecast covering all assigned centers in the active scope.
        </p>
      </header>

      {/* B. Demand Profile */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-y border-[var(--color-hairline)] py-6 mb-12">
        <div className="flex-1 min-w-0 pr-6 border-b md:border-b-0 md:border-r border-[var(--color-hairline)] mb-4 md:mb-0 pb-4 md:pb-0">
          <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">10-Week Forecast</p>
          <p className="text-[28px] font-serif tracking-tight text-[var(--color-ink)]" title={formatFull(meal.predicted_orders)}>
            {formatCompact(meal.predicted_orders)}
          </p>
        </div>
        <div className="flex-1 min-w-0 px-0 md:px-6 border-b md:border-b-0 md:border-r border-[var(--color-hairline)] mb-4 md:mb-0 pb-4 md:pb-0">
          <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Preparation Req</p>
          <p className="text-[28px] font-serif tracking-tight text-[var(--color-caution)]" title={formatFull(prep)}>
            {formatCompact(prep)}
          </p>
        </div>
        <div className="flex-1 min-w-0 px-0 md:px-6 border-b md:border-b-0 md:border-r border-[var(--color-hairline)] mb-4 md:mb-0 pb-4 md:pb-0">
          <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Buffer Volume</p>
          <p className="text-[28px] font-serif tracking-tight text-[var(--color-ink)]" title={formatFull(bufferVol)}>
            +{formatCompact(bufferVol)}
          </p>
        </div>
        <div className="flex-1 min-w-0 md:pl-6">
          <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase tracking-wider">Peak Week</p>
          <p className="text-[28px] font-serif tracking-tight text-[var(--color-ink)]">
            W{meal.peak_week}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* C & F. Weekly Forecast Trajectory (History + Forecast) */}
        <div className="lg:col-span-2 border border-[var(--color-hairline)] rounded-lg p-6 bg-white shadow-sm">
          <div className="mb-6">
            <h2 className="text-[16px] font-serif mb-1">Weekly Trajectory</h2>
            <p className="text-[13px] text-[var(--color-ink-secondary)]">Historical demand vs predicted requirements.</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(20,19,15,0.06)" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} width={50} />
                <Tooltip content={<CustomChartTooltip />} cursor={{ stroke: 'rgba(20,19,15,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <ReferenceLine x={145.5} stroke="var(--color-ink-tertiary)" strokeDasharray="3 3" label={{ position: 'top', value: 'FORECAST', fill: 'var(--color-ink-tertiary)', fontSize: 10, fontWeight: 600 }} />
                
                <Area type="monotone" dataKey="actual" stroke="var(--color-ink-secondary)" strokeWidth={2} fillOpacity={0.1} fill="var(--color-ink-secondary)" connectNulls />
                <Area type="monotone" dataKey="predicted" stroke="var(--color-brand)" strokeWidth={2} fillOpacity={0.1} fill="var(--color-brand)" connectNulls />
                {bufferPct > 0 && (
                  <Area type="monotone" dataKey="prep" stroke="var(--color-caution)" strokeWidth={2} fill="none" strokeDasharray="4 4" connectNulls />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center space-x-6 mt-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-[var(--color-ink-secondary)] opacity-50"></div>
              <span className="text-[11px] font-medium text-[var(--color-ink-secondary)] uppercase">Actual Demand</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-[var(--color-brand)] opacity-50"></div>
              <span className="text-[11px] font-medium text-[var(--color-ink-secondary)] uppercase">Predicted Demand</span>
            </div>
            {bufferPct > 0 && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-0.5 bg-[var(--color-caution)]"></div>
                <span className="text-[11px] font-medium text-[var(--color-ink-secondary)] uppercase">Prep Req</span>
              </div>
            )}
          </div>
        </div>

        {/* E. Preparation Profile */}
        <div className="border border-[var(--color-hairline)] rounded-lg p-6 bg-[rgba(20,19,15,0.02)] flex flex-col">
          <h2 className="text-[16px] font-serif mb-6">Preparation Profile</h2>
          {prepProfile && (
            <div className="space-y-6 flex-1">
              <div>
                <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase">Highest Prep Week</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-[20px] font-serif">{formatFull(prepProfile.max)}</span>
                  <span className="text-[13px] text-[var(--color-ink-secondary)]">W{prepProfile.maxW}</span>
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--color-hairline)]">
                <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase">Lowest Prep Week</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-[20px] font-serif">{formatFull(prepProfile.min)}</span>
                  <span className="text-[13px] text-[var(--color-ink-secondary)]">W{prepProfile.minW}</span>
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--color-hairline)]">
                <p className="text-[12px] font-medium text-[var(--color-ink-secondary)] mb-1 uppercase">Max WoW Increase</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-[20px] font-serif text-[var(--color-growth)]">+{formatFull(prepProfile.maxInc > 0 ? prepProfile.maxInc : 0)}</span>
                </div>
              </div>
            </div>
          )}
          <p className="text-[11px] text-[var(--color-ink-tertiary)] mt-6 italic">
            The preparation buffer is a planning margin applied to predicted demand. It represents additional planned preparation, not measured food waste.
          </p>
        </div>
      </div>

      {/* D. Center Contribution */}
      <div className="border border-[var(--color-hairline)] rounded-lg p-6 bg-white shadow-sm">
        <h2 className="text-[16px] font-serif mb-1">Center Contribution</h2>
        <p className="text-[13px] text-[var(--color-ink-secondary)] mb-6">Top fulfillment centers driving demand for this meal.</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-hairline)]">
                <th className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider">Facility</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider text-right">Predicted</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider text-right">Share of Meal</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider text-right">Prep Req</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider text-right">Buffer Vol</th>
              </tr>
            </thead>
            <tbody>
              {meal.center_contributions.map((c) => {
                const itemPrep = c.predicted_orders * (1 + bufferPct)
                const itemBuffer = itemPrep - c.predicted_orders
                const share = (c.predicted_orders / meal.predicted_orders) * 100
                return (
                  <tr key={c.center_id} className="border-b border-[var(--color-hairline)] last:border-0 hover:bg-[rgba(20,19,15,0.02)] transition-colors cursor-pointer group" onClick={() => navigate(`/centers/${c.center_id}`)}>
                    <td className="py-3 px-4">
                      <div className="text-[13px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-brand)] transition-colors">Center {c.center_id}</div>
                      <div className="text-[11px] text-[var(--color-ink-secondary)] flex items-center mt-0.5">
                        <MapPin className="w-3 h-3 mr-1" />
                        <span>{c.simulated_city} · {c.center_type}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-ink)] text-right" title={formatFull(c.predicted_orders)}>
                      {formatCompact(c.predicted_orders)}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-[var(--color-ink-secondary)] text-right font-mono">
                      {share.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-caution)] text-right" title={formatFull(itemPrep)}>
                      {formatCompact(itemPrep)}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-[var(--color-ink-secondary)] text-right" title={formatFull(itemBuffer)}>
                      +{formatCompact(itemBuffer)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

