import { useState, useMemo } from 'react'
import { ForecastTable } from '../../components/forecasts/ForecastTable'

export function MealForecastExplorer({ forecasts }: { forecasts: any[] }) {
  const [week, setWeek] = useState<string>('')
  
  const distinctWeeks = useMemo(() => {
    const s = new Set(forecasts.map(f => f.week))
    return Array.from(s).sort((a,b) => a - b)
  }, [forecasts])

  const filtered = useMemo(() => {
    if (!week) return forecasts
    return forecasts.filter(f => String(f.week) === week)
  }, [forecasts, week])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[18px] font-heading font-bold tracking-tight text-[var(--color-text)]">Forecast Manifest</h3>
        <div className="flex items-center space-x-3">
          <span className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Filter Week</span>
          <select 
            value={week} 
            onChange={e => setWeek(e.target.value)}
            className="appearance-none bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[12px] font-bold text-[var(--color-text)] py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] cursor-pointer shadow-sm"
          >
            <option value="">All Weeks</option>
            {distinctWeeks.map(w => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </div>
      </div>
      <ForecastTable data={filtered} />
    </div>
  )
}