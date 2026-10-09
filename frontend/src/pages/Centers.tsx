import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCentersAnalysis } from '../lib/api'
import { useAppContext } from '../context/AppContext'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { CentersSummary } from '../components/centers/CentersSummary'
import { CentersDirectory } from '../components/centers/CentersDirectory'
import { CentersDistribution } from '../components/centers/CentersDistribution'

export interface CentersFilterState {
  city: string;
  type: string;
  search: string;
}

export function Centers() {
  const { buffer } = useAppContext()
  const bufferPct = buffer / 100
  const [filters, setFilters] = useState<CentersFilterState>({ city: '', type: '', search: '' })

  const { data: centers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['centers_analysis'],
    queryFn: getCentersAnalysis
  })

  const filteredCenters = useMemo(() => {
    return centers.filter(c => {
      if (filters.city && c.simulated_city !== filters.city) return false;
      if (filters.type && c.center_type !== filters.type) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (!c.center_id.toString().includes(s) && !c.simulated_city.toLowerCase().includes(s)) return false;
      }
      return true;
    })
  }, [centers, filters])

  const totalFilteredDemand = useMemo(() => filteredCenters.reduce((sum, c) => sum + c.predicted_orders, 0), [filteredCenters])

  const topCenter = useMemo(() => {
    if (!filteredCenters.length) return null
    return [...filteredCenters].sort((a, b) => b.predicted_orders - a.predicted_orders)[0]
  }, [filteredCenters])

  const insight = topCenter 
    ? `Center ${topCenter.center_id} represents the largest share of forecast demand (${((topCenter.predicted_orders / totalFilteredDemand) * 100).toFixed(1)}% of filtered view) across the planning horizon.`
    : `Compare demand forecasts and preparation requirements across the center network.`

  if (isLoading) {
    return (
      <div className="max-w-[1120px] mx-auto pb-16 pt-8 animate-pulse">
        <div className="h-10 bg-black/5 w-1/4 mb-4 rounded"></div>
        <div className="h-4 bg-black/5 w-2/3 mb-12 rounded"></div>
        <div className="h-24 bg-black/5 w-full mb-8 rounded"></div>
        <div className="h-64 bg-black/5 w-full rounded"></div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="max-w-[1120px] mx-auto flex flex-col items-center justify-center py-24">
        <AlertCircle className="w-10 h-10 text-[var(--color-risk)] mb-4" />
        <h2 className="text-lg font-semibold mb-2">Unable to load center analysis</h2>
        <button onClick={() => refetch()} className="flex items-center space-x-2 px-4 py-2 rounded-md bg-[var(--color-brand)] text-white text-[13px] font-medium mt-4">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-[1120px] mx-auto pb-16">
      <header className="pt-8 mb-10 max-w-[760px]">
        <h1 className="font-serif text-[28px] leading-[1.25] tracking-tight text-[var(--color-ink)] mb-2">
          Centers
        </h1>
        <p className="text-[15px] text-[var(--color-ink-secondary)] leading-relaxed">
          {insight}
        </p>
      </header>

      <CentersSummary centers={filteredCenters} bufferPct={bufferPct} />
      
      <CentersDistribution centers={filteredCenters} bufferPct={bufferPct} />

      <CentersDirectory 
        centers={filteredCenters} 
        allCenters={centers}
        filters={filters}
        setFilters={setFilters}
        bufferPct={bufferPct}
      />
    </div>
  )
}