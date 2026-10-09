import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { formatAxisTick } from '../../lib/format'
import { LineChart as ChartIcon } from 'lucide-react'

export function AnalyticsTrend({ data }: { data: any[] }) {
  if (!data.length) return null

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg px-4 py-3">
        <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
          Week {payload[0].payload.week}
        </div>
        <div className="flex justify-between items-center space-x-4 text-[13px]">
          <span className="text-[var(--color-text-secondary)] font-medium">Observed Demand</span>
          <span className="font-bold tabular-nums text-[var(--color-text)]">{payload[0].value.toLocaleString('en-IN')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] p-6 shadow-sm mb-8" aria-label="Historical demand pattern">
      <div className="mb-6 flex items-center space-x-2">
        <ChartIcon className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-[16px] font-heading font-bold tracking-tight text-[var(--color-text)]">Historical Demand Trajectory</h3>
      </div>
      <div className="h-[280px] w-full -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorHist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-hist)" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="var(--color-chart-hist)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12, fontWeight: 500 }} dy={10} minTickGap={30} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12, fontWeight: 500 }} tickFormatter={formatAxisTick} width={56} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="total_orders" stroke="var(--color-chart-hist)" strokeWidth={2} fillOpacity={1} fill="url(#colorHist)" activeDot={{ r: 4, fill: 'var(--color-chart-hist)', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}