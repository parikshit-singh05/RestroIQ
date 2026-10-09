import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnalytics, getDetailedForecasts } from '../lib/api'
import { getDistinct } from '../lib/computations'
import { AnalyticsFilters } from '../components/analytics/AnalyticsFilters'
import { AnalyticsTrend } from '../components/analytics/AnalyticsTrend'
import { AnalyticsDistribution } from '../components/analytics/AnalyticsDistribution'
import { AnalyticsPromotions } from '../components/analytics/AnalyticsPromotions'
import { AnalyticsContext } from '../components/analytics/AnalyticsContext'
import { AnalyticsModel } from '../components/analytics/AnalyticsModel'
import { AnalyticsRead } from '../components/analytics/AnalyticsRead'
import { AlertCircle, RefreshCw } from 'lucide-react'

export function Analytics() {
  const [filters, setFilters] = useState<any>({
    start_week: '',
    end_week: '',
    city: '',
    centerId: '',
    category: '',
    cuisine: ''
  })

  // We need distinct values for dropdowns. We'll fetch detailed forecasts just to extract meta.
  const detQ = useQuery({
    queryKey: ['forecast_detail_meta'],
    queryFn: () => getDetailedForecasts(undefined, 50000),
    staleTime: 60 * 60 * 1000
  })

  // We fetch analytics from the new endpoint, passing current filters
  const anaQ = useQuery({
    queryKey: ['analytics', filters],
    queryFn: () => getAnalytics(filters),
    staleTime: 5 * 60 * 1000
  })

  const distinctCities = useMemo(() => detQ.data ? getDistinct(detQ.data, 'simulated_city') : [], [detQ.data])
  const distinctCenters = useMemo(() => {
    if (!detQ.data) return []
    const base = filters.city ? detQ.data.filter(d => d.simulated_city === filters.city) : detQ.data
    return getDistinct(base, 'center_id')
  }, [detQ.data, filters.city])
  const distinctCategories = useMemo(() => detQ.data ? getDistinct(detQ.data, 'category') : [], [detQ.data])
  const distinctCuisines = useMemo(() => detQ.data ? getDistinct(detQ.data, 'cuisine') : [], [detQ.data])

  const isLoading = anaQ.isLoading
  const isError = anaQ.isError

  if (isLoading && !anaQ.data) {
    return (
      <div className="max-w-[1120px] mx-auto animate-pulse pb-16">
        <div className="h-10 bg-[rgba(20,19,15,0.06)] rounded w-3/4 mb-4" />
        <div className="h-32 bg-[rgba(20,19,15,0.04)] rounded-lg mb-10 w-[800px]" />
        <div className="h-16 bg-[rgba(20,19,15,0.02)] border-y border-[var(--color-hairline)] mb-8" />
        <div className="h-[300px] bg-[rgba(20,19,15,0.02)] rounded-lg mb-8" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="max-w-[1120px] mx-auto flex flex-col items-center justify-center py-24">
        <AlertCircle className="w-10 h-10 text-[var(--color-risk)] mb-4" />
        <h2 className="text-lg font-semibold mb-2">Unable to load analytics</h2>
        <button onClick={() => anaQ.refetch()} className="flex items-center space-x-2 px-4 py-2 rounded-md bg-[var(--color-brand)] text-white text-[13px] font-medium mt-4">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    )
  }

  const d = anaQ.data

  return (
    <div className="max-w-[1120px] mx-auto pb-16">
      <header className="pt-8 mb-10 max-w-[760px]">
        <h1 className="font-serif text-[28px] leading-[1.25] tracking-tight text-[var(--color-ink)] mb-1.5">
          Analytical Intelligence
        </h1>
        <p className="text-[15px] text-[var(--color-ink-secondary)]">
          Explore historical demand patterns, promotional associations, and model signals.
        </p>
      </header>

      {d && <AnalyticsRead dist={d.distribution} promo={d.promotion} />}

      <AnalyticsFilters 
        filters={filters} 
        setFilters={setFilters}
        distinctCities={distinctCities}
        distinctCenters={distinctCenters}
        distinctCategories={distinctCategories}
        distinctCuisines={distinctCuisines}
      />

      {d && (
        <>
          <AnalyticsTrend data={d.trend} />
          
          <div className="flex flex-col lg:flex-row gap-8">
            <AnalyticsDistribution dist={d.distribution} />
            <div className="flex flex-col gap-8 flex-1">
              <AnalyticsPromotions promo={d.promotion} />
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8">
            <AnalyticsModel model={d.model} />
            <AnalyticsContext ctx={d.context} />
          </div>
        </>
      )}
    </div>
  )
}
