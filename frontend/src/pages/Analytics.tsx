import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnalytics as getAnalyticsData } from '../lib/api'
import { getDistinct } from '../lib/computations'
import { AnalyticsFilters, type AnalyticsFilterState } from '../components/analytics/AnalyticsFilters'
import { AnalyticsTrend } from '../components/analytics/AnalyticsTrend'
import { AnalyticsDistribution } from '../components/analytics/AnalyticsDistribution'
import { AnalyticsPromotions } from '../components/analytics/AnalyticsPromotions'
import { AnalyticsModel } from '../components/analytics/AnalyticsModel'
import { AnalyticsRead } from '../components/analytics/AnalyticsRead'
import { AlertCircle, RefreshCw } from 'lucide-react'

export function Analytics() {
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    start_week: '1',
    end_week: '145',
    city: '',
    centerId: '',
    category: '',
    cuisine: ''
  })

  const { data, isLoading, isError, refetch } = useQuery({ 
    queryKey: ['analytics', filters], 
    queryFn: () => getAnalyticsData(filters), 
    staleTime: 5 * 60 * 1000 
  })

  const distinctQuery = useQuery({ queryKey: ['analytics', {}], queryFn: () => getAnalyticsData({}), staleTime: Infinity })

  if (isLoading || !data) {
    return (
      <div className="w-full animate-pulse">
        <div className="pt-6 lg:pt-8 mb-8 h-20 bg-[var(--color-border)] rounded-lg max-w-[800px]" />
        <div className="h-[200px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8">
           <div className="h-[300px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
           <div className="h-[300px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 w-full h-full">
        <div className="w-16 h-16 rounded-full bg-[var(--color-danger-bg)] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" />
        </div>
        <h2 className="text-lg font-heading font-bold text-[var(--color-text)] mb-2">Unable to load analytics</h2>
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

  // Build filter options from unfiltered data if available
  const baseData = distinctQuery.data?.raw_sample || []
  const distinctCities = useMemo(() => getDistinct(baseData, 'simulated_city'), [baseData])
  const distinctCenters = useMemo(() => {
    const b = filters.city ? baseData.filter((d:any) => d.simulated_city === filters.city) : baseData
    return getDistinct(b, 'center_id')
  }, [baseData, filters.city])
  const distinctCategories = useMemo(() => getDistinct(baseData, 'category'), [baseData])
  const distinctCuisines = useMemo(() => getDistinct(baseData, 'cuisine'), [baseData])

  return (
    <div className="w-full pb-16 animate-in fade-in duration-500">
      <header className="pt-6 lg:pt-8 mb-6 max-w-[800px]">
        <h1 className="font-heading font-extrabold text-[28px] lg:text-[32px] leading-[1.2] tracking-tight text-[var(--color-text)] mb-2">
          Historical Analytics
        </h1>
        <p className="text-[15px] font-medium text-[var(--color-text-secondary)]">
          Explore past demand patterns and view the features influencing model predictions.
        </p>
      </header>

      <AnalyticsFilters 
        filters={filters} 
        setFilters={setFilters}
        distinctCities={distinctCities}
        distinctCenters={distinctCenters}
        distinctCategories={distinctCategories}
        distinctCuisines={distinctCuisines}
      />

      <AnalyticsRead dist={data.distribution} promo={data.promotion} />

      <AnalyticsTrend data={data.trend} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <AnalyticsDistribution dist={data.distribution} />
        <div className="flex flex-col space-y-6 lg:space-y-8">
          <AnalyticsPromotions promo={data.promotion} />
          <AnalyticsModel model={data.model_features || []} />
        </div>
      </div>
    </div>
  )
}

