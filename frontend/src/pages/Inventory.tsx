import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getInventory, getDetailedForecasts } from '../lib/api'
import { getDistinct } from '../lib/computations'
import { InventoryRead } from '../components/inventory/InventoryRead'
import { InventoryScenarios } from '../components/inventory/InventoryScenarios'
import { InventoryChart } from '../components/inventory/InventoryChart'
import { InventoryStrip } from '../components/inventory/InventoryStrip'
import { InventoryPriorities } from '../components/inventory/InventoryPriorities'
import { InventoryFilters, type FilterState } from '../components/inventory/InventoryFilters'
import { InventorySkeleton } from '../components/inventory/InventorySkeleton'
import { AlertCircle, RefreshCw, Info } from 'lucide-react'
import type { ForecastSummary,  } from '../lib/types'

export function Inventory() {
  const [filters, setFilters] = useState<FilterState>({
    week: '',
    city: '',
    centerId: '',
    category: '',
    cuisine: '',
    search: ''
  })

  // We fetch ALL detailed inventory records for the 10 weeks so client-side cross-filtering works instantly.
  const invQ = useQuery({ 
    queryKey: ['inventory_all'], 
    queryFn: () => getInventory(undefined, 50000),
    staleTime: 5 * 60 * 1000 
  })
  
  // We need city/cuisine etc. from DetailedForecasts because  doesn't have it explicitly
  // Wait, does  have city/category?
  // Our types.ts says  ONLY has center_id and meal_id!
  // To cross filter, we need the detailed forecasts with the join.
  const detQ = useQuery({
    queryKey: ['forecast_detail_all'],
    queryFn: () => getDetailedForecasts(undefined, 50000),
    staleTime: 5 * 60 * 1000
  })

  const isLoading = invQ.isLoading || detQ.isLoading
  const isError = invQ.isError || detQ.isError

  // Join detailed metadata onto inventory recommendations
  const joinedData = useMemo(() => {
    if (!invQ.data || !detQ.data) return []
    // DetailedForecasts has the string fields.
    const metaMap = new Map()
    detQ.data.forEach(d => {
      metaMap.set(`${d.week}-${d.center_id}-${d.meal_id}`, d)
    })
    
    return invQ.data.map(i => {
      const meta = metaMap.get(`${i.week}-${i.center_id}-${i.meal_id}`)
      return {
        ...i,
        simulated_city: meta?.simulated_city || '',
        category: meta?.category || '',
        cuisine: meta?.cuisine || '',
        checkout_price: meta?.checkout_price || 0
      }
    })
  }, [invQ.data, detQ.data])

  const distinctWeeks = useMemo(() => getDistinct(joinedData, 'week'), [joinedData])
  const distinctCities = useMemo(() => getDistinct(joinedData, 'simulated_city'), [joinedData])
  const distinctCenters = useMemo(() => {
    const base = filters.city ? joinedData.filter(d => d.simulated_city === filters.city) : joinedData
    return getDistinct(base, 'center_id')
  }, [joinedData, filters.city])
  const distinctCategories = useMemo(() => getDistinct(joinedData, 'category'), [joinedData])
  const distinctCuisines = useMemo(() => getDistinct(joinedData, 'cuisine'), [joinedData])

  const filteredData = useMemo(() => {
    return joinedData.filter(d => {
      if (filters.week && String(d.week) !== filters.week) return false
      if (filters.city && d.simulated_city !== filters.city) return false
      if (filters.centerId && String(d.center_id) !== filters.centerId) return false
      if (filters.category && d.category !== filters.category) return false
      if (filters.cuisine && d.cuisine !== filters.cuisine) return false
      
      if (filters.search) {
        const s = filters.search.toLowerCase()
        const centerMatch = `center ${d.center_id}`.includes(s) || d.center_id.toString().includes(s)
        const mealMatch = `meal ${d.meal_id}`.includes(s) || d.meal_id.toString().includes(s)
        if (!centerMatch && !mealMatch) return false
      }
      return true
    })
  }, [joinedData, filters])

  // Compute summary dynamically from filtered data so chart responds to Category/City filters!
  const computedSummary = useMemo(() => {
    const map = new Map<number, ForecastSummary>()
    filteredData.forEach(d => {
      if (!map.has(d.week)) {
        map.set(d.week, { week: d.week, total_predicted_orders: 0, average_predicted_orders: 0, highest_demand_category: '', highest_demand_city: '' })
      }
      const cur = map.get(d.week)!
      cur.total_predicted_orders += d.predicted_orders
    })
    return Array.from(map.values()).sort((a,b) => a.week - b.week)
  }, [filteredData])

  if (isLoading) return <InventorySkeleton />

  if (isError) {
    return (
      <div className="max-w-[1120px] mx-auto flex flex-col items-center justify-center py-24">
        <AlertCircle className="w-10 h-10 text-[var(--color-risk)] mb-4" />
        <h2 className="text-lg font-semibold mb-2">Unable to load operational plan</h2>
        <button
          onClick={() => { invQ.refetch(); detQ.refetch() }}
          className="flex items-center space-x-2 px-4 py-2 rounded-md bg-[var(--color-brand)] text-white text-[13px] font-medium mt-4"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    )
  }

  const totalFilteredDemand = computedSummary.reduce((sum, s) => sum + s.total_predicted_orders, 0)
  const activeWeekNumber = filters.week ? Number(filters.week) : (computedSummary.length > 0 ? computedSummary[0].week : 146)

  return (
    <div className="max-w-[1120px] mx-auto pb-16">
      <header className="pt-8 mb-10 max-w-[760px]">
        <h1 className="font-serif text-[28px] leading-[1.25] tracking-tight text-[var(--color-ink)] mb-1.5">
          Preparation Plan
        </h1>
        <p className="text-[15px] text-[var(--color-ink-secondary)]">
          Plan preparation requirements and buffer volumes across the 10-week horizon.
        </p>
      </header>

      {/* Global Filters */}
      <InventoryFilters 
        filters={filters} 
        setFilters={setFilters}
        distinctWeeks={distinctWeeks}
        distinctCities={distinctCities}
        distinctCenters={distinctCenters}
        distinctCategories={distinctCategories}
        distinctCuisines={distinctCuisines}
      />

      <InventoryRead summary={computedSummary} detailed={filteredData} />

      <InventoryScenarios totalForecast={totalFilteredDemand} />

      <InventoryChart summary={computedSummary} selectedWeek={activeWeekNumber} />

      <InventoryStrip summary={computedSummary} />

      <InventoryPriorities data={filteredData} />

      {/* Buffer Explanation Note */}
      <div className="mt-8 flex items-start space-x-2 bg-[rgba(20,19,15,0.02)] p-4 rounded-lg border border-[var(--color-hairline)]">
        <Info className="w-4 h-4 text-[var(--color-ink-secondary)] mt-0.5 flex-shrink-0" />
        <p className="text-[12px] text-[var(--color-ink-secondary)] leading-relaxed">
          Preparation buffer is an optional planning margin applied mathematically to predicted demand. It represents additional planned preparation capacity, not measured food waste or guaranteed inventory surplus. Priority rankings are determined strictly by total planned preparation volume.
        </p>
      </div>
    </div>
  )
}


