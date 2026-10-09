import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { formatAxisTick } from '../../lib/format'
import { Calendar } from 'lucide-react'

export function WeekDetail({ week, data }: { week: number, data: any[] }) {
  
  const chartData = useMemo(() => {
    const wData = data.filter(d => d.week === week)
    const map = new Map<string, number>()
    wData.forEach(d => {
      map.set(d.simulated_city, (map.get(d.simulated_city) || 0) + d.predicted_orders)
    })
    return Array.from(map.entries())
      .map(([name, orders]) => ({ name, orders }))
      .sort((a,b) => b.orders - a.orders)
      .slice(0, 5)
  }, [data, week])

  if (!chartData.length) return null

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm p-6" aria-label="City Volume">
      <div className="flex items-center space-x-2 mb-6">
        <Calendar className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-[15px] font-heading font-bold text-[var(--color-text)] tracking-tight">Week {week} Top Cities</h3>
      </div>
      
      <div className="h-[200px] w-full -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
            <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatAxisTick} tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11, fontWeight: 500 }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 600 }} width={80} />
            <Tooltip 
              cursor={{ fill: 'var(--color-surface-alt)' }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg px-3 py-2">
                    <div className="text-[12px] font-bold text-[var(--color-text)]">{payload[0].payload.name}</div>
                    <div className="text-[13px] font-bold text-[var(--color-accent)] tabular-nums">{payload[0].value.toLocaleString('en-IN')} orders</div>
                  </div>
                )
              }} 
            />
            <Bar dataKey="orders" fill="var(--color-accent)" radius={[0, 4, 4, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

