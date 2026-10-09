import { useMemo } from 'react'
import type { DetailedForecast } from '../../lib/types'
import { formatCompact } from '../../lib/format'
import { CalendarDays, Utensils, MapPin, Box } from 'lucide-react'

interface Props {
  week: number
  data: DetailedForecast[]
}

export function WeekDetail({ week, data }: Props) {
  const stats = useMemo(() => {
    if (!data.length) return { total: 0, centers: 0, meals: 0, avg: 0 }
    
    let total = 0
    const centers = new Set()
    const meals = new Set()
    
    data.forEach(d => {
      total += d.predicted_orders
      centers.add(d.center_id)
      meals.add(d.meal_id)
    })
    
    return {
      total,
      centers: centers.size,
      meals: meals.size,
      avg: total / data.length
    }
  }, [data])

  if (!data.length) return null

  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 mb-8" aria-label="Week details">
      <div className="flex items-center space-x-2 mb-6">
        <CalendarDays className="w-4 h-4 text-[var(--color-ink-secondary)]" />
        <h3 className="text-[15px] font-semibold tracking-tight">Week {week} snapshot</h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Stat icon={Box} label="Total predicted" value={formatCompact(stats.total)} sub="orders" />
        <Stat icon={MapPin} label="Active centers" value={stats.centers.toString()} sub="facilities" />
        <Stat icon={Utensils} label="Menu items" value={stats.meals.toString()} sub="unique meals" />
        <Stat icon={Box} label="Average volume" value={Math.round(stats.avg).toLocaleString('en-IN')} sub="predicted per meal" />
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, sub }: { icon: any, label: string, value: string, sub: string }) {
  return (
    <div>
      <div className="flex items-center space-x-1.5 mb-1.5 text-[11px] font-medium text-[var(--color-ink-secondary)] uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5 opacity-70" />
        <span>{label}</span>
      </div>
      <div className="flex items-baseline space-x-1.5">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--color-ink)]">{value}</span>
        <span className="text-[12px] text-[var(--color-ink-secondary)]">{sub}</span>
      </div>
    </div>
  )
}