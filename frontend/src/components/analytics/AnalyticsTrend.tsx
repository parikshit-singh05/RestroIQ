import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { formatAxisTick } from '../../lib/format'

export function AnalyticsTrend({ data }: { data: any[] }) {
  if (!data.length) return null

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-hairline)] rounded-lg shadow-lg px-4 py-3">
        <div className="text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider mb-1">
          Week {payload[0].payload.week}
        </div>
        <div className="flex justify-between items-center space-x-4 text-[13px]">
          <span className="text-[var(--color-ink-secondary)]">Observed Demand</span>
          <span className="font-semibold tabular-nums">{payload[0].value.toLocaleString('en-IN')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 mb-8" aria-label="Historical demand pattern">
      <div className="mb-6">
        <h3 className="text-[15px] font-semibold tracking-tight">Historical Demand Pattern</h3>
        <p className="text-[13px] text-[var(--color-ink-secondary)] mt-0.5">
          Observed total weekly volume across the available 145-week history.
        </p>
      </div>
      <div className="h-[240px] w-full -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(20,19,15,0.06)" />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11, fontWeight: 500 }} dy={8} minTickGap={30} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(20,19,15,0.5)', fontSize: 11 }} tickFormatter={formatAxisTick} width={56} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(20,19,15,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="total_orders" stroke="var(--color-ink)" strokeWidth={2} fillOpacity={1} fill="rgba(20,19,15,0.03)" activeDot={{ r: 4, fill: 'var(--color-ink)' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

