import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDetailedForecasts } from '../lib/api'
import { getDistinct } from '../lib/computations'
import { InventoryFilters, type InvFilterState } from '../components/inventory/InventoryFilters'
import { InventoryPriorities } from '../components/inventory/InventoryPriorities'
import { InventoryScenarios } from '../components/inventory/InventoryScenarios'
import { InventoryStrip } from '../components/inventory/InventoryStrip'
import { InventoryRead } from '../components/inventory/InventoryRead'
import { InventorySkeleton } from '../components/inventory/InventorySkeleton'
import { AlertCircle, RefreshCw } from 'lucide-react'

export function Inventory() {
  const [filters, setFilters] = useState<InvFilterState>({
    week: '146',
    category: '',
    centerId: ''
  })

  const { data, isLoading, isError, refetch } = useQuery({ 
    queryKey: ['forecast_detail_inventory'], 
    queryFn: () => getDetailedForecasts(undefined, 50000), 
    staleTime: 5 * 60 * 1000 
  })

  const distinctWeeks = useMemo(() => getDistinct(data || [], 'week'), [data])
  const distinctCategories = useMemo(() => getDistinct(data || [], 'category'), [data])
  const distinctCenters = useMemo(() => getDistinct(data || [], 'center_id'), [data])

  const filteredData = useMemo(() => {
    if (!data) return []
    return data.filter(d => {
      if (filters.week && String(d.week) !== filters.week) return false
      if (filters.category && d.category !== filters.category) return false
      if (filters.centerId && String(d.center_id) !== filters.centerId) return false
      return true
    })
  }, [data, filters])

  if (isLoading) return <InventorySkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 w-full h-full">
        <div className="w-16 h-16 rounded-full bg-[var(--color-danger-bg)] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" />
        </div>
        <h2 className="text-lg font-heading font-bold text-[var(--color-text)] mb-2">Unable to load inventory data</h2>
        <button
          onClick={() => refetch()}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-[14px] font-semibold transition-colors shadow-sm mt-4"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    )
  }

  return (
    <div className="w-full pb-16 animate-in fade-in duration-500">
      <header className="pt-6 lg:pt-8 mb-8 max-w-[800px]">
        <h1 className="font-heading font-extrabold text-[28px] lg:text-[32px] leading-[1.2] tracking-tight text-[var(--color-text)] mb-2">
          Inventory Planning
        </h1>
        <p className="text-[15px] font-medium text-[var(--color-text-secondary)]">
          Translate demand forecasts into concrete preparation targets and prioritize risk.
        </p>
      </header>

      <InventoryFilters 
        filters={filters} 
        setFilters={setFilters}
        distinctWeeks={distinctWeeks}
        distinctCategories={distinctCategories}
        distinctCenters={distinctCenters}
      />

      <InventoryStrip data={filteredData} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
        <div className="lg:col-span-2">
          <InventoryPriorities data={filteredData} />
        </div>
        <div className="flex flex-col space-y-6 lg:space-y-8">
          <InventoryScenarios data={filteredData} />
          <InventoryRead data={filteredData} />
        </div>
      </div>
    </div>
  )
}