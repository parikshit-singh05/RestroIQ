import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine } from 'recharts'
import type { ForecastSummary } from '../../lib/types'
import { formatAxisTick } from '../../lib/format'
import { computePeakWeek } from '../../lib/computations'

interface Props {
  summary: ForecastSummary[]
  selectedWeek: number
  onSelectWeek: (w: number) => void
}

export function ForecastExplorer({ summary, selectedWeek, onSelectWeek }: Props) {
  if (!summary.length) return null

  const peak = computePeakWeek(summary)

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    
    const idx = summary.findIndex(s => s.week === d.week)
    let deltaText = null
    if (idx > 0) {
      const prev = summary[idx - 1].total_predicted_orders
      const curr = d.total_predicted_orders
      const pct = (((curr - prev) / prev) * 100).toFixed(1)
      deltaText = `${Number(pct) >= 0 ? '+' : ''}${pct}% WoW`
    }

    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-hairline)] rounded-lg shadow-lg px-4 py-3 min-w-[160px]">
        <div className="text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider mb-1.5 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span>Week {d.week}</span>
            {selectedWeek === d.week ? (
              <span className="text-[9px] bg-[rgba(20,19,15,0.06)] px-1.5 py-0.5 rounded text-[var(--color-ink)] font-bold tracking-widest">SELECTED</span>
            ) : (
              <span className="text-[9px] border border-[rgba(20,19,15,0.1)] px-1.5 py-0.5 rounded text-[var(--color-ink-secondary)] font-medium tracking-widest">PREVIEW</span>
            )}
          </div>
          {deltaText && <span className="text-[10px] bg-[rgba(20,19,15,0.04)] px-1.5 py-0.5 rounded">{deltaText}</span>}
        </div>
        <p className="text-xl font-semibold tabular-nums tracking-tight">
          {Math.round(d.total_predicted_orders).toLocaleString('en-IN')}
        </p>
        <p className="text-[12px] text-[var(--color-ink-secondary)] mt-0.5">predicted orders</p>
        {selectedWeek !== d.week && (
          <p className="text-[11px] font-medium text-[var(--color-brand)] mt-2 pt-2 border-t border-[var(--color-hairline)]">
            Click to explore
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 mb-8 select-none" aria-label="10-week forecast explorer">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">10-week forecast outlook</h2>
          <p className="text-[13px] text-[var(--color-ink-secondary)] mt-0.5">
            Select a week to explore detailed predictions and geographic distribution.
          </p>
        </div>
      </div>
      <div className="h-[220px] w-full -ml-4 cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={summary} onClick={(e) => { if (e?.activeLabel) onSelectWeek(Number(e.activeLabel)) }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(20,19,15,0.06)" />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11, fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11 }}
              tickFormatter={formatAxisTick}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20,19,15,0.02)' }} />
            
            {/* Highlight the selected week area */}
            <ReferenceArea
              x1={selectedWeek - 0.5}
              x2={selectedWeek + 0.5}
              fill="var(--color-brand)"
              fillOpacity={0.06}
            />
            <ReferenceLine 
              x={selectedWeek} 
              stroke="var(--color-brand)" 
              strokeOpacity={0.3} 
              strokeDasharray="3 3" 
            />
            
            <Area
              type="monotone"
              dataKey="total_predicted_orders"
              fill="rgba(224, 73, 43, 0.04)"
              stroke="none"
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="total_predicted_orders"
              stroke="var(--color-brand)"
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props
                if (!cx || !cy) return <svg key={payload.week} />
                const isSelected = payload.week === selectedWeek
                const isPeak = payload.week === peak.week
                return (
                  <g key={payload.week}>
                    <circle
                      cx={cx} cy={cy}
                      r={isSelected || isPeak ? 5 : 3}
                      fill={(isSelected || isPeak) ? (isPeak ? 'var(--color-peak)' : 'var(--color-brand)') : 'var(--color-surface)'}
                      stroke={isPeak ? 'var(--color-peak)' : 'var(--color-brand)'}
                      strokeWidth={isSelected || isPeak ? 0 : 2}
                      className="transition-all duration-200"
                    />
                    {isPeak && !isSelected && (
                      <text x={cx} y={cy - 12} textAnchor="middle" fill="var(--color-peak)" fontSize={10} fontWeight={600}>
                        Peak
                      </text>
                    )}
                  </g>
                )
              }}
              activeDot={{ r: 6, fill: 'var(--color-brand)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}