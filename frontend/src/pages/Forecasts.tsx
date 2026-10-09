import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDetailedForecasts } from '../lib/api'
import { getDistinct } from '../lib/computations'
import { ForecastFilters, type FilterState } from '../components/forecasts/ForecastFilters'
import { ForecastTable } from '../components/forecasts/ForecastTable'
import { ForecastSkeleton } from '../components/forecasts/ForecastSkeleton'
import { ForecastInsights } from '../components/forecasts/ForecastInsights'
import { WeekDetail } from '../components/forecasts/WeekDetail'
import { CategoryBreakdown } from '../components/forecasts/CategoryBreakdown'
import { AlertCircle, RefreshCw } from 'lucide-react'

export function Forecasts() {
  const [filters, setFilters] = useState<FilterState>({
    week: '',
    city: '',
    centerId: '',
    category: '',
    cuisine: '',
    search: ''
  })

  const { data, isLoading, isError, refetch } = useQuery({ 
    queryKey: ['forecast_detail_all'], 
    queryFn: () => getDetailedForecasts(undefined, 50000), 
    staleTime: 5 * 60 * 1000 
  })

  const distinctWeeks = useMemo(() => getDistinct(data || [], 'week'), [data])
  const distinctCities = useMemo(() => getDistinct(data || [], 'simulated_city'), [data])
  const distinctCenters = useMemo(() => {
    const base = filters.city ? (data || []).filter(d => d.simulated_city === filters.city) : (data || [])
    return getDistinct(base, 'center_id')
  }, [data, filters.city])
  const distinctCategories = useMemo(() => getDistinct(data || [], 'category'), [data])
  const distinctCuisines = useMemo(() => getDistinct(data || [], 'cuisine'), [data])

  const filteredData = useMemo(() => {
    if (!data) return []
    return data.filter(d => {
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
  }, [data, filters])

  if (isLoading) return <ForecastSkeleton />

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 w-full h-full">
        <div className="w-16 h-16 rounded-full bg-[var(--color-danger-bg)] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" />
        </div>
        <h2 className="text-lg font-heading font-bold text-[var(--color-text)] mb-2">Unable to load forecasts</h2>
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

  const selectedWeek = filters.week ? Number(filters.week) : 146

  return (
    <div className="w-full pb-16 animate-in fade-in duration-500">
      <header className="pt-6 lg:pt-8 mb-8 max-w-[800px]">
        <h1 className="font-heading font-extrabold text-[28px] lg:text-[32px] leading-[1.2] tracking-tight text-[var(--color-text)] mb-2">
          Forecast Workspace
        </h1>
        <p className="text-[15px] font-medium text-[var(--color-text-secondary)]">
          Explore and filter item-level predictions across the 10-week horizon.
        </p>
      </header>

      <ForecastFilters 
        filters={filters} 
        setFilters={setFilters}
        distinctWeeks={distinctWeeks}
        distinctCities={distinctCities}
        distinctCenters={distinctCenters}
        distinctCategories={distinctCategories}
        distinctCuisines={distinctCuisines}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8 mt-6">
        <div className="lg:col-span-1">
          <ForecastInsights data={filteredData} />
        </div>
        <div className="lg:col-span-2 flex flex-col space-y-6 lg:space-y-8">
          <WeekDetail week={selectedWeek} data={filteredData} />
          <CategoryBreakdown data={filteredData} />
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-heading font-bold tracking-tight text-[var(--color-text)]">
            Forecast Details
          </h3>
          <span className="px-2.5 py-1 rounded bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[12px] font-bold text-[var(--color-text-secondary)]">
            {filteredData.length.toLocaleString('en-IN')} results
          </span>
        </div>
        <ForecastTable data={filteredData} />
      </div>
    </div>
  )
}
