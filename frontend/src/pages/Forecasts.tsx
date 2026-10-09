import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getForecastSummary, getDetailedForecasts } from '../lib/api'
import { getDistinct } from '../lib/computations'
import { ForecastExplorer } from '../components/forecasts/ForecastExplorer'
import { ForecastFilters, type FilterState } from '../components/forecasts/ForecastFilters'
import { WeekDetail } from '../components/forecasts/WeekDetail'
import { CategoryBreakdown } from '../components/forecasts/CategoryBreakdown'
import { ForecastTable } from '../components/forecasts/ForecastTable'
import { ForecastInsights } from '../components/forecasts/ForecastInsights'
import { ForecastSkeleton } from '../components/forecasts/ForecastSkeleton'
import { AlertCircle, RefreshCw } from 'lucide-react'

export function Forecasts() {
  const [selectedWeek, setSelectedWeek] = useState<number>(146)
  const [filters, setFilters] = useState<FilterState>({
    city: '',
    centerId: '',
    category: '',
    cuisine: '',
    search: ''
  })

  // Data Fetching
  const summaryQ = useQuery({ queryKey: ['forecast_summary'], queryFn: getForecastSummary })
  const detailQ = useQuery({ 
    queryKey: ['forecast_detail', selectedWeek], 
    queryFn: () => getDetailedForecasts(selectedWeek, 5000),
    staleTime: 5 * 60 * 1000 // Keep cached when swapping weeks
  })

  const isLoading = summaryQ.isLoading || detailQ.isLoading
  const isError = summaryQ.isError || detailQ.isError

  // Distinct values for filters (computed from raw fetched data)
  const rawData = detailQ.data ?? []
  const distinctCities = useMemo(() => getDistinct(rawData, 'simulated_city'), [rawData])
  const distinctCenters = useMemo(() => {
    const base = filters.city ? rawData.filter(d => d.simulated_city === filters.city) : rawData
    return getDistinct(base, 'center_id')
  }, [rawData, filters.city])
  const distinctCategories = useMemo(() => getDistinct(rawData, 'category'), [rawData])
  const distinctCuisines = useMemo(() => getDistinct(rawData, 'cuisine'), [rawData])

  // Apply filters client-side instantly
  const filteredData = useMemo(() => {
    return rawData.filter(d => {
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
  }, [rawData, filters])

  if (isLoading) return <ForecastSkeleton />

  if (isError) {
    return (
      <div className="max-w-[1120px] mx-auto flex flex-col items-center justify-center py-24">
        <AlertCircle className="w-10 h-10 text-[var(--color-risk)] mb-4" />
        <h2 className="text-lg font-semibold mb-2">Unable to load forecasts</h2>
        <button
          onClick={() => { summaryQ.refetch(); detailQ.refetch() }}
          className="flex items-center space-x-2 px-4 py-2 rounded-md bg-[var(--color-brand)] text-white text-[13px] font-medium mt-4 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    )
  }

  const summary = summaryQ.data ?? []

  return (
    <div className="max-w-[1120px] mx-auto pb-16">
      <header className="pt-8 mb-8 max-w-[760px]">
        <h1 className="font-serif text-[28px] leading-[1.25] tracking-tight text-[var(--color-ink)] mb-1.5">
          Detailed Forecasts
        </h1>
        <p className="text-[15px] text-[var(--color-ink-secondary)]">
          Explore the 10-week outlook and drill down into specific predictions.
        </p>
      </header>

      {/* 1. 10-Week Explorer */}
      <ForecastExplorer 
        summary={summary} 
        selectedWeek={selectedWeek} 
        onSelectWeek={setSelectedWeek} 
      />

      {/* 2. Global Filters */}
      <ForecastFilters 
        filters={filters} 
        setFilters={setFilters}
        distinctCities={distinctCities}
        distinctCenters={distinctCenters}
        distinctCategories={distinctCategories}
        distinctCuisines={distinctCuisines}
      />

      {/* 3. Snapshot & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-1">
          <ForecastInsights data={filteredData} week={selectedWeek} />
        </div>
        <div className="lg:col-span-2 flex flex-col space-y-8">
          <WeekDetail week={selectedWeek} data={filteredData} />
          <CategoryBreakdown data={filteredData} />
        </div>
      </div>

      {/* 4. Detailed Table */}
      <h3 className="text-[15px] font-semibold tracking-tight mb-4 flex items-center">
        Forecast Details
        <span className="ml-3 px-2 py-0.5 rounded bg-[rgba(20,19,15,0.04)] text-[11px] font-medium text-[var(--color-ink-secondary)]">
          {filteredData.length.toLocaleString('en-IN')} results
        </span>
      </h3>
      <ForecastTable data={filteredData} />
    </div>
  )
}