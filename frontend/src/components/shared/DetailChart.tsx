import { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { formatAxisTick } from '../../lib/format'
import { LineChart as ChartIcon } from 'lucide-react'

export function DetailChart({ history, forecast, title, subtitle }: { history: any[], forecast: any[], title: string, subtitle?: string }) {
  const chartData = useMemo(() => {
    const histPoints = history.map(h => ({
      week: h.week,
      actual: h.total_orders || h.num_orders,
      forecast: null as number | null,
      type: 'actual' as const,
    }))

    const bridge = histPoints.length > 0 && forecast.length > 0
      ? [{
          week: histPoints[histPoints.length - 1].week,
          actual: null as number | null,
          forecast: histPoints[histPoints.length - 1].actual,
          type: 'bridge' as const,
        }]
      : []

    const forecastPoints = forecast.map(f => ({
      week: f.week,
      actual: null as number | null,
      forecast: f.predicted_orders || f.total_predicted_orders,
      type: 'forecast' as const,
    }))

    return [...histPoints, ...bridge, ...forecastPoints].sort((a,b) => a.week - b.week)
  }, [history, forecast])

  if (!chartData.length) return null

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const val = d.actual ?? d.forecast
    if (val == null) return null
    const isActual = d.type === 'actual'

    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg px-4 py-3 min-w-[160px]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Week {d.week}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActual ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]' : 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'}`}>
            {isActual ? 'Actual' : 'Forecast'}
          </span>
        </div>
        <p className="text-xl font-heading font-bold tabular-nums tracking-tight text-[var(--color-text)]">
          {Math.round(val).toLocaleString('en-IN')}
        </p>
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] p-6 shadow-sm mb-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <ChartIcon className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-[16px] font-heading font-bold tracking-tight text-[var(--color-text)]">{title}</h3>
          </div>
          {subtitle && <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center space-x-4 text-[12px] font-bold">
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 rounded-sm bg-[var(--color-text-tertiary)] opacity-50" />
            <span className="text-[var(--color-text-secondary)]">Historical</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 rounded-sm bg-[var(--color-accent)]" />
            <span className="text-[var(--color-text-secondary)]">Forecast</span>
          </div>
        </div>
      </div>

      <div className="h-[280px] w-full -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11, fontWeight: 600 }} dy={10} minTickGap={20} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11, fontWeight: 600 }} tickFormatter={formatAxisTick} width={50} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            
            <Area type="monotone" dataKey="actual" fill="var(--color-chart-hist)" fillOpacity={0.1} stroke="var(--color-chart-hist)" strokeWidth={2} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls={false} />
            <Line type="monotone" dataKey="forecast" stroke="var(--color-accent)" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-accent)' }} connectNulls={false} />
            
            {forecast.length > 0 && history.length > 0 && (
              <ReferenceLine x={forecast[0].week - 0.5} stroke="var(--color-border)" strokeDasharray="4 4" label={{ value: 'Forecast Start', position: 'insideTopRight', fill: 'var(--color-text-tertiary)', fontSize: 10, fontWeight: 700 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

