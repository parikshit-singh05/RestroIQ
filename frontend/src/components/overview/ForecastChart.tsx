import { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { ForecastSummary, HistorySummary } from '../../lib/types'
import { computePeakWeek } from '../../lib/computations'
import { formatAxisTick } from '../../lib/format'

interface Props {
  history: HistorySummary[]
  forecast: ForecastSummary[]
}

export function ForecastChart({ history, forecast }: Props) {
  const peak = computePeakWeek(forecast)
  // // const wow = computeLargestWoWChange(forecast)

  const chartData = useMemo(() => {
    const histPoints = history.map(h => ({
      week: h.week,
      actual: h.total_orders,
      forecast: null as number | null,
      type: 'actual' as const,
    }))

    // Bridge: last actual connects to first forecast
    const bridge = history.length > 0 && forecast.length > 0
      ? [{
          week: history[history.length - 1].week,
          actual: null as number | null,
          forecast: history[history.length - 1].total_orders,
          type: 'bridge' as const,
        }]
      : []

    const forecastPoints = forecast.map(f => ({
      week: f.week,
      actual: null as number | null,
      forecast: f.total_predicted_orders,
      type: 'forecast' as const,
    }))

    return [...histPoints, ...bridge, ...forecastPoints]
  }, [history, forecast])

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const val = d.actual ?? d.forecast
    if (val == null) return null

    const isActual = d.type === 'actual'

    // Find prev week for delta
    const idx = chartData.findIndex(p => p.week === d.week)
    let delta: string | null = null
    if (idx > 0) {
      const prevVal = chartData[idx - 1].actual ?? chartData[idx - 1].forecast
      if (prevVal && prevVal > 0) {
        const pct = ((val - prevVal) / prevVal * 100).toFixed(1)
        delta = `${Number(pct) >= 0 ? '+' : ''}${pct}% vs prev week`
      }
    }

    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-hairline)] rounded-lg shadow-lg px-4 py-3 min-w-[180px]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider">
            Week {d.week}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isActual ? 'bg-[var(--color-normal-bg)] text-[var(--color-normal)]' : 'bg-[var(--color-peak-bg)] text-[var(--color-brand)]'}`}>
            {isActual ? 'Actual' : 'Forecast'}
          </span>
        </div>
        <p className="text-xl font-semibold tabular-nums tracking-tight">
          {Math.round(val).toLocaleString('en-IN')}
          <span className="text-[13px] font-normal text-[var(--color-ink-secondary)] ml-1">orders</span>
        </p>
        {delta && (
          <p className="text-[12px] text-[var(--color-ink-secondary)] mt-1 pt-1.5 border-t border-[var(--color-hairline)]">
            {delta}
          </p>
        )}
      </div>
    )
  }

  return (
    <section className="mb-8" aria-label="Demand forecast chart">
      <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 pb-4">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight mb-0.5">Demand trajectory: history into forecast</h2>
            <p className="text-[13px] text-[var(--color-ink-secondary)]">
              Weeks 136-145 actual, Weeks 146-155 predicted. Peak at Week {peak.week}.
            </p>
          </div>
          <div className="flex items-center space-x-5 text-[12px]">
            <div className="flex items-center space-x-1.5">
              <div className="w-5 h-[2px] bg-[var(--color-normal)] rounded" />
              <span className="text-[var(--color-ink-secondary)]">Actual</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-5 h-[2px] bg-[var(--color-brand)] rounded" />
              <span className="text-[var(--color-ink-secondary)]">Forecast</span>
            </div>
          </div>
        </div>

        <div className="h-[260px] w-full -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(20,19,15,0.06)"
              />
              <XAxis
                dataKey="week"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11, fontWeight: 500 }}
                dy={8}
                interval={1}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11 }}
                tickFormatter={formatAxisTick}
                width={48}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'rgba(20,19,15,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
              />

              {/* Forecast start marker */}
              <ReferenceLine
                x={145.5}
                stroke="var(--color-brand)"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                label={{
                  value: 'Forecast start',
                  position: 'insideTopRight',
                  fill: 'var(--color-brand)',
                  fontSize: 10,
                  fontWeight: 600,
                  dy: -4,
                }}
              />

              {/* Actual demand area */}
              <Area
                type="monotone"
                dataKey="actual"
                fill="rgba(100,116,139,0.08)"
                stroke="var(--color-normal)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--color-normal)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
                connectNulls={false}
              />

              {/* Forecast line */}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="var(--color-brand)"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props
                  if (!cx || !cy || payload.type === 'bridge') return <svg key={payload.week} />
                  const isPeak = payload.week === peak.week
                  return (
                    <g key={payload.week}>
                      <circle
                        cx={cx} cy={cy}
                        r={isPeak ? 6 : 3.5}
                        fill={isPeak ? 'var(--color-peak)' : 'var(--color-surface)'}
                        stroke={isPeak ? 'var(--color-peak)' : 'var(--color-brand)'}
                        strokeWidth={isPeak ? 2.5 : 2}
                      />
                      {isPeak && (
                        <text
                          x={cx} y={cy - 14}
                          textAnchor="middle"
                          fill="var(--color-peak)"
                          fontSize={10}
                          fontWeight={700}
                        >
                          Peak
                        </text>
                      )}
                    </g>
                  )
                }}
                activeDot={{ r: 5, fill: 'var(--color-brand)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}