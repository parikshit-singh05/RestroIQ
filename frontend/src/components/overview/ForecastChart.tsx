import { useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import type { ForecastSummary } from '../../lib/types'
import { formatAxisTick } from '../../lib/format'
import { computePeakWeek } from '../../lib/computations'
import { useAppContext } from '../../context/AppContext'
import { BarChart2 } from 'lucide-react'

interface Props {
  summary: ForecastSummary[]
}

export function ForecastChart({ summary }: Props) {
  const { buffer } = useAppContext()
  const peak = computePeakWeek(summary)

  const data = useMemo(() => {
    return summary.map(s => ({
      week: s.week,
      orders: s.total_predicted_orders,
      prep: s.total_predicted_orders * (1 + buffer / 100)
    }))
  }, [summary, buffer])

  if (!data.length) return null

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg px-4 py-3 min-w-[180px]">
        <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 pb-2 border-b border-[var(--color-border-subtle)]">
          Week {payload[0].payload.week}
        </div>
        <div className="flex flex-col space-y-2">
          {payload.map((p: any) => (
            <div key={p.dataKey} className="flex justify-between items-center text-[13px]">
              <div className="flex items-center">
                <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: p.color }} />
                <span className="text-[var(--color-text-secondary)] font-medium">
                  {p.dataKey === 'orders' ? 'Predicted Demand' : 'Prep Target'}
                </span>
              </div>
              <span className="font-bold tabular-nums ml-4 text-[var(--color-text)]">{p.value.toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] p-6 shadow-sm h-full flex flex-col" aria-label="Forecast Trajectory Chart">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 mb-1.5">
            <BarChart2 className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-[16px] font-heading font-bold tracking-tight text-[var(--color-text)]">Forecast Trajectory</h3>
          </div>
          <p className="text-[13px] text-[var(--color-text-secondary)] font-medium">Predicted volume vs planned preparation.</p>
        </div>
      </div>
      
      <div className="flex-grow min-h-[300px] w-full -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
            <XAxis 
              dataKey="week" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12, fontWeight: 500 }} 
              dy={10} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12, fontWeight: 500 }} 
              tickFormatter={formatAxisTick} 
              width={50} 
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            
            <Area 
              type="monotone" 
              dataKey="orders" 
              stroke="var(--color-accent)" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorOrders)" 
              activeDot={{ r: 5, fill: 'var(--color-accent)', strokeWidth: 0 }} 
            />
            
            {buffer > 0 && (
              <Area 
                type="monotone" 
                dataKey="prep" 
                stroke="var(--color-success)" 
                strokeWidth={2} 
                fill="none" 
                strokeDasharray="4 4" 
                activeDot={{ r: 4, fill: 'var(--color-success)', strokeWidth: 0 }}
              />
            )}
            
            {peak.week > 0 && (
              <ReferenceLine 
                x={peak.week} 
                stroke="var(--color-danger)" 
                strokeDasharray="3 3" 
                strokeOpacity={0.5}
                label={{ position: 'top', value: 'PEAK', fill: 'var(--color-danger)', fontSize: 10, fontWeight: 800 }} 
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex items-center justify-center space-x-6 mt-6 pt-4 border-t border-[var(--color-border-subtle)]">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded bg-[var(--color-accent)] opacity-80 shadow-sm"></div>
          <span className="text-[12px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Predicted Demand</span>
        </div>
        {buffer > 0 && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--color-success)]"></div>
            <span className="text-[12px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Prep Target</span>
          </div>
        )}
      </div>
    </div>
  )
}