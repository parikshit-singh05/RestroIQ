import type { DetailedForecast } from '../../lib/types'
import { formatCompact } from '../../lib/format'
import { Activity } from 'lucide-react'
import { useMemo } from 'react'

interface Props {
  data: DetailedForecast[]
  week: number
}

export function ForecastInsights({ data, week }: Props) {
  const insights = useMemo(() => {
    if (!data.length) return []
    
    // Total
    const total = data.reduce((sum, d) => sum + d.predicted_orders, 0)
    
    // Top center
    const centers = new Map<string, number>()
    let topCenter = { name: '', vol: 0 }
    
    // Top category
    const categories = new Map<string, number>()
    let topCat = { name: '', vol: 0 }

    data.forEach(d => {
      const cName = `Center ${d.center_id} (${d.simulated_city})`
      const cVol = (centers.get(cName) || 0) + d.predicted_orders
      centers.set(cName, cVol)
      if (cVol > topCenter.vol) topCenter = { name: cName, vol: cVol }

      const catVol = (categories.get(d.category) || 0) + d.predicted_orders
      categories.set(d.category, catVol)
      if (catVol > topCat.vol) topCat = { name: d.category, vol: catVol }
    })

    const obs = []
    obs.push(`Currently viewing ${formatCompact(total)} predicted orders for Week ${week}.`)
    if (topCat.name) {
      obs.push(`The ${topCat.name} category drives the largest segment of this filtered view at ${formatCompact(topCat.vol)} orders.`)
    }
    if (topCenter.name) {
      obs.push(`${topCenter.name} holds the highest concentration of volume in this segment.`)
    }
    
    return obs
  }, [data, week])

  if (!insights.length) return null

  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 h-full">
      <div className="flex items-center space-x-2 mb-4">
        <Activity className="w-4 h-4 text-[var(--color-ink-secondary)]" />
        <h3 className="text-[15px] font-semibold tracking-tight">Contextual read</h3>
      </div>
      <div className="space-y-3">
        {insights.map((obs, i) => (
          <div key={i} className="flex items-start space-x-3 text-[13px] text-[var(--color-ink-secondary)] leading-relaxed">
            <span className="w-1 h-1 rounded-full bg-[var(--color-ink-secondary)] mt-[7px] flex-shrink-0 opacity-50" />
            <span>{obs}</span>
          </div>
        ))}
      </div>
    </div>
  )
}