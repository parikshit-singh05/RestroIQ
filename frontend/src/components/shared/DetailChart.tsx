import { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { formatAxisTick } from '../../lib/format'
import { LineChart as ChartIcon } from 'lucide-react'

export interface DetailChartProps {
  history?: any[]
  forecast?: any[]
  title?: string
  subtitle?: string
  bufferPct?: number
}

export function DetailChart({
  history = [],
  forecast = [],
  title = 'Weekly Demand Trajectory',
  subtitle,
  bufferPct = 0,
}: DetailChartProps) {
  const chartData = useMemo(() => {
    // 1. Group history by week
    const histMap = new Map<number, number>()
    for (const h of history) {
      const w = Number(h.week)
      const qty = Number(h.num_orders ?? h.total_orders ?? h.actual ?? 0)
      if (!isNaN(w) && w > 0 && !isNaN(qty) && qty >= 0) {
        histMap.set(w, (histMap.get(w) || 0) + qty)
      }
    }

    // 2. Group forecast by week
    const fcMap = new Map<number, number>()
    for (const f of forecast) {
      const w = Number(f.week)
      const qty = Number(f.predicted_orders ?? f.total_predicted_orders ?? f.predicted ?? 0)
      if (!isNaN(w) && w > 0 && !isNaN(qty) && qty >= 0) {
        fcMap.set(w, (fcMap.get(w) || 0) + qty)
      }
    }

    const allWeeks = Array.from(new Set([...histMap.keys(), ...fcMap.keys()])).sort((a, b) => a - b)
    if (!allWeeks.length) return []

    return allWeeks.map((week) => {
      const actual = histMap.has(week) ? Math.round(histMap.get(week)!) : null
      const predicted = fcMap.has(week) ? Math.round(fcMap.get(week)! * 100) / 100 : null
      const prep = predicted !== null && bufferPct > 0 ? Math.round(predicted * (1 + bufferPct) * 100) / 100 : null

      return {
        week,
        actual,
        predicted,
        prep,
      }
    })
  }, [history, forecast, bufferPct])

  const hasHistory = useMemo(() => chartData.some((d) => d.actual !== null), [chartData])
  const hasForecast = useMemo(() => chartData.some((d) => d.predicted !== null), [chartData])

  const firstForecastWeek = useMemo(() => {
    const pt = chartData.find((d) => d.predicted !== null)
    return pt ? pt.week : null
  }, [chartData])

  if (!chartData.length) {
    return (
      <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-8 text-center text-[13px] font-medium text-[var(--color-text-tertiary)] shadow-sm mb-8">
        No demand trajectory observations available for this selection.
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    if (!d) return null
    const isActual = d.actual !== null && d.actual !== undefined
    const isForecast = d.predicted !== null && d.predicted !== undefined

    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl px-4 py-3 min-w-[200px]">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-[var(--color-border-subtle)]">
          <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Week {d.week}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isActual
                ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
                : 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-semibold'
            }`}
          >
            {isActual ? 'Historical Observation' : 'ML Forecast'}
          </span>
        </div>

        {isActual && (
          <div className="flex items-center justify-between space-x-4">
            <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Actual Orders</span>
            <span className="text-[16px] font-heading font-bold tabular-nums text-[var(--color-text)]">
              {Math.round(d.actual).toLocaleString('en-IN')}
            </span>
          </div>
        )}

        {isForecast && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between space-x-4">
              <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Predicted Demand</span>
              <span className="text-[16px] font-heading font-bold tabular-nums text-[var(--color-accent)]">
                {Math.round(d.predicted).toLocaleString('en-IN')}
              </span>
            </div>

            {bufferPct > 0 && d.prep !== null && (
              <>
                <div className="flex items-center justify-between space-x-4 pt-1.5 border-t border-[var(--color-border-subtle)]">
                  <span className="text-[12px] font-medium text-[#F59E0B]">
                    Prep Target (+{Math.round(bufferPct * 100)}%)
                  </span>
                  <span className="text-[14px] font-heading font-bold tabular-nums text-[#F59E0B]">
                    {Math.round(d.prep).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center justify-between space-x-4 text-[11px]">
                  <span className="text-[var(--color-text-tertiary)] font-medium">Planning Buffer</span>
                  <span className="font-semibold tabular-nums text-[var(--color-text-secondary)]">
                    +{Math.round(d.prep - d.predicted).toLocaleString('en-IN')}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 shadow-sm mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <ChartIcon className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="text-[16px] font-heading font-bold tracking-tight text-[var(--color-text)]">{title}</h3>
          </div>
          {subtitle && <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[12px] font-bold">
          {hasHistory && (
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 rounded-sm bg-[var(--color-chart-hist)] opacity-80" />
              <span className="text-[var(--color-text-secondary)]">Historical Actuals</span>
            </div>
          )}
          {hasForecast && (
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 rounded-sm bg-[var(--color-accent)]" />
              <span className="text-[var(--color-text-secondary)]">Predicted Demand</span>
            </div>
          )}
          {hasForecast && bufferPct > 0 && (
            <div className="flex items-center space-x-1.5">
              <div className="w-3.5 h-0.5 border-t-2 border-dashed border-[#F59E0B]" />
              <span className="text-[var(--color-text-secondary)]">Prep Target (+{Math.round(bufferPct * 100)}%)</span>
            </div>
          )}
        </div>
      </div>

      <div className="h-[300px] w-full -ml-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="detailActualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-hist)" stopOpacity={0.16} />
                <stop offset="95%" stopColor="var(--color-chart-hist)" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="detailForecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.16} />
                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />

            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11, fontWeight: 600 }}
              tickFormatter={(w) => `W${w}`}
              dy={8}
              minTickGap={16}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11, fontWeight: 600 }}
              tickFormatter={formatAxisTick}
              width={54}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />

            {hasHistory && hasForecast && firstForecastWeek !== null && (
              <ReferenceLine
                x={firstForecastWeek}
                stroke="var(--color-border)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'FORECAST HORIZON',
                  position: 'insideTopRight',
                  fill: 'var(--color-text-tertiary)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              />
            )}

            {hasHistory && (
              <Area
                type="monotone"
                dataKey="actual"
                name="Historical Actuals"
                stroke="var(--color-chart-hist)"
                strokeWidth={2.5}
                fill="url(#detailActualGrad)"
                dot={{ r: 3, fill: 'var(--color-chart-hist)', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--color-chart-hist)', strokeWidth: 0 }}
                connectNulls={false}
              />
            )}

            {hasForecast && (
              <Area
                type="monotone"
                dataKey="predicted"
                name="Predicted Demand"
                stroke="var(--color-accent)"
                strokeWidth={2.5}
                fill="url(#detailForecastGrad)"
                dot={{ r: 3, fill: 'var(--color-accent)', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--color-accent)', strokeWidth: 0 }}
                connectNulls={false}
              />
            )}

            {hasForecast && bufferPct > 0 && (
              <Line
                type="monotone"
                dataKey="prep"
                name={`Prep Target (+${Math.round(bufferPct * 100)}%)`}
                stroke="#F59E0B"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, fill: '#F59E0B', strokeWidth: 0 }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
