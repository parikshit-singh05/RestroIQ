import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts'
import type { ForecastSummary } from '../../lib/types'
import { formatAxisTick } from '../../lib/format'
import { useAppContext } from '../../context/AppContext'

interface Props {
  summary: ForecastSummary[]
  selectedWeek: number
}

export function InventoryChart({ summary, selectedWeek }: Props) {
  const { buffer } = useAppContext()

  if (!summary.length) return null

  const chartData = summary.map(s => ({
    week: s.week,
    demand: s.total_predicted_orders,
    prep: s.total_predicted_orders * (1 + buffer / 100),
    gap: s.total_predicted_orders * (buffer / 100)
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-hairline)] rounded-lg shadow-lg px-4 py-3 min-w-[200px]">
        <div className="text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider mb-2 border-b border-[var(--color-hairline)] pb-2">
          Week {d.week} Plan
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-[var(--color-ink-secondary)]">Predicted</span>
            <span className="font-medium tabular-nums">{Math.round(d.demand).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-[var(--color-brand)] font-medium">Preparation</span>
            <span className="font-semibold tabular-nums text-[var(--color-brand)]">{Math.round(d.prep).toLocaleString('en-IN')}</span>
          </div>
          {buffer > 0 && (
            <div className="flex justify-between items-center text-[12px] pt-1 mt-1 border-t border-[rgba(20,19,15,0.06)]">
              <span className="text-[var(--color-ink-secondary)]">Additional buffer</span>
              <span className="font-medium tabular-nums text-[var(--color-ink-secondary)]">+{Math.round(d.gap).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 mb-8" aria-label="Preparation plan visualization">
      <div className="mb-6">
        <h3 className="text-[15px] font-semibold tracking-tight">Predicted Demand vs Recommended Preparation</h3>
        <p className="text-[13px] text-[var(--color-ink-secondary)] mt-0.5">
          10-week planning horizon based on selected {buffer}% buffer.
        </p>
      </div>
      <div className="h-[260px] w-full -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(20,19,15,0.06)" />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11, fontWeight: 500 }} dy={8} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11 }} tickFormatter={formatAxisTick} width={56} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20,19,15,0.02)' }} />
            
            {/* Highlight selected week */}
            <ReferenceArea x1={selectedWeek - 0.5} x2={selectedWeek + 0.5} fill="rgba(20,19,15,0.03)" />
            
            {/* Gap Area */}
            <Area type="monotone" dataKey="prep" fill="rgba(224, 73, 43, 0.06)" stroke="none" activeDot={false} />
            <Area type="monotone" dataKey="demand" fill="var(--color-surface)" stroke="none" activeDot={false} />
            
            {/* Lines */}
            <Line type="monotone" dataKey="demand" stroke="var(--color-ink-secondary)" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4, fill: 'var(--color-ink-secondary)' }} />
            <Line type="monotone" dataKey="prep" stroke="var(--color-brand)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-surface)', strokeWidth: 2 }} activeDot={{ r: 6, fill: 'var(--color-brand)' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
