import { useState, useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import type { DetailedForecast } from '../../lib/types'
import { formatAxisTick } from '../../lib/format'

interface Props {
  data: DetailedForecast[]
}

export function CategoryBreakdown({ data }: Props) {
  const [view, setView] = useState<'category' | 'cuisine'>('category')

  const chartData = useMemo(() => {
    const agg = new Map<string, number>()
    data.forEach(d => {
      const key = d[view]
      agg.set(key, (agg.get(key) || 0) + d.predicted_orders)
    })
    
    return Array.from(agg.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [data, view])

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-hairline)] rounded-lg shadow-lg px-3 py-2 min-w-[120px]">
        <p className="text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider mb-1">{payload[0].payload.name}</p>
        <p className="text-[13px] font-semibold tabular-nums text-[var(--color-ink)]">
          {Math.round(payload[0].value).toLocaleString('en-IN')} orders
        </p>
      </div>
    )
  }

  if (!data.length) return null

  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 h-full flex flex-col" aria-label="Distribution breakdown">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[15px] font-semibold tracking-tight">Demand distribution</h3>
        <div className="flex items-center bg-[rgba(20,19,15,0.04)] p-0.5 rounded-md">
          <button
            onClick={() => setView('category')}
            className={`px-3 py-1 text-[12px] font-medium rounded transition-colors ${view === 'category' ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]'}`}
          >
            Category
          </button>
          <button
            onClick={() => setView('cuisine')}
            className={`px-3 py-1 text-[12px] font-medium rounded transition-colors ${view === 'cuisine' ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]'}`}
          >
            Cuisine
          </button>
        </div>
      </div>

      <div className="flex-1 w-full -ml-4 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(20,19,15,0.06)" />
            <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatAxisTick} tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-ink)', fontSize: 11, fontWeight: 500 }} width={80} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20,19,15,0.02)' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--color-brand)' : 'var(--color-normal)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}