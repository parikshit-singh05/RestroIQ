import { useState, useMemo } from 'react'
import type { MealAnalysis } from '../../lib/types'
import { formatCompact, formatFull } from '../../lib/format'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function MealsDistribution({ meals, totalDemand, bufferPct }: { meals: MealAnalysis[], totalDemand: number, bufferPct: number }) {
  const [metric, setMetric] = useState<'predicted' | 'prep'>('predicted')
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const data = useMemo(() => {
    let list = meals.map(m => ({
      id: m.meal_id,
      name: `Meal ${m.meal_id}`,
      predicted: m.predicted_orders,
      prep: m.predicted_orders * (1 + bufferPct),
      share: totalDemand > 0 ? (m.predicted_orders / totalDemand) * 100 : 0,
      category: m.category,
      cuisine: m.cuisine
    }))
    
    list = list.sort((a, b) => b[metric] - a[metric])
    return expanded ? list : list.slice(0, 10)
  }, [meals, metric, bufferPct, expanded, totalDemand])

  if (!data.length) return null

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-hairline)] shadow-sm px-4 py-3 rounded-md min-w-[220px]">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-[var(--color-hairline)]">
          <span className="font-serif text-[16px]">{d.name}</span>
        </div>
        <div className="text-[11px] text-[var(--color-ink-secondary)] mb-3">{d.category} · {d.cuisine}</div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[12px] text-[var(--color-ink-secondary)]">Predicted Orders</span>
          <span className="text-[13px] font-medium">{formatFull(d.predicted)}</span>
        </div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[12px] text-[var(--color-ink-secondary)]">Recommended Prep</span>
          <span className="text-[13px] font-medium text-[var(--color-caution)]">{formatFull(d.prep)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 mt-2 border-t border-[var(--color-hairline)]">
          <span className="text-[12px] text-[var(--color-ink-secondary)]">Share of View</span>
          <span className="text-[13px] font-medium">{d.share.toFixed(1)}%</span>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-hairline)] bg-white rounded-lg p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h2 className="text-[16px] font-serif mb-1">Demand Distribution</h2>
          <p className="text-[13px] text-[var(--color-ink-secondary)]">
            Forecast concentration across meal items.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center bg-[rgba(20,19,15,0.03)] p-1 rounded-md border border-[var(--color-hairline)]">
          <button 
            onClick={() => setMetric('predicted')}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-sm transition-colors cursor-pointer ${metric === 'predicted' ? 'bg-white shadow-sm border border-[var(--color-hairline)] text-[var(--color-ink)]' : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]'}`}
          >
            Predicted Orders
          </button>
          <button 
            onClick={() => setMetric('prep')}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-sm transition-colors cursor-pointer ${metric === 'prep' ? 'bg-white shadow-sm border border-[var(--color-hairline)] text-[var(--color-ink)]' : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]'}`}
          >
            Recommended Prep
          </button>
        </div>
      </div>

      <div className="w-full flex-1 min-h-[400px]" style={{ height: expanded ? `${Math.max(400, data.length * 40)}px` : '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(20,19,15,0.06)" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} />
            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'rgba(20,19,15,0.8)', fontSize: 12, fontWeight: 500 }} width={80} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20,19,15,0.02)' }} />
            <Bar 
              dataKey={metric} 
              radius={[0, 2, 2, 0]} 
              barSize={20}
              onClick={(d) => navigate(`/meals/${d.id}`)}
              style={{ cursor: 'pointer' }}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--color-brand)' : 'var(--color-normal)'} fillOpacity={index === 0 ? 0.9 : 0.6} className="transition-opacity hover:opacity-80" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {meals.length > 10 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-hairline)] flex justify-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center space-x-1 text-[13px] font-medium text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{expanded ? 'Show Top 10' : `Show All ${meals.length} Meals`}</span>
          </button>
        </div>
      )}
    </div>
  )
}
