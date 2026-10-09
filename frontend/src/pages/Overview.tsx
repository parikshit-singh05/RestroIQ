import { useQuery } from '@tanstack/react-query'
import { getForecastSummary, getHistorySummary, getInventory, getCenters, getMeals } from '../lib/api'
import { HeadlineInsight } from '../components/overview/HeadlineInsight'
import { ForecastChart } from '../components/overview/ForecastChart'
import { NumbersStrip } from '../components/overview/NumbersStrip'
import { NeedsAttention } from '../components/overview/NeedsAttention'
import { OperationalRead } from '../components/overview/OperationalRead'
import { SecondaryContext } from '../components/overview/SecondaryContext'
import { OverviewSkeleton } from '../components/overview/OverviewSkeleton'
import { AlertCircle, RefreshCw } from 'lucide-react'

export function Overview() {
  const historyQ = useQuery({ queryKey: ['history'], queryFn: getHistorySummary })
  const forecastQ = useQuery({ queryKey: ['forecast_summary'], queryFn: getForecastSummary })
  const inventoryQ = useQuery({ queryKey: ['inventory', 1000], queryFn: () => getInventory(1000) })
  const centersQ = useQuery({ queryKey: ['centers'], queryFn: getCenters })
  const mealsQ = useQuery({ queryKey: ['meals'], queryFn: getMeals })

  const isLoading = historyQ.isLoading || forecastQ.isLoading || inventoryQ.isLoading || centersQ.isLoading || mealsQ.isLoading
  const isError = historyQ.isError || forecastQ.isError || inventoryQ.isError || centersQ.isError || mealsQ.isError

  if (isLoading) return <OverviewSkeleton />

  if (isError) {
    return (
      <div className="max-w-[1120px] mx-auto flex flex-col items-center justify-center py-24">
        <AlertCircle className="w-10 h-10 text-[var(--color-risk)] mb-4" />
        <h2 className="text-lg font-semibold mb-2">Unable to load forecast data</h2>
        <p className="text-[13px] text-[var(--color-ink-secondary)] mb-6 text-center max-w-md">
          The API server may be unavailable. Ensure the FastAPI backend is running on port 8000 and try again.
        </p>
        <button
          onClick={() => {
            historyQ.refetch()
            forecastQ.refetch()
            inventoryQ.refetch()
            centersQ.refetch()
            mealsQ.refetch()
          }}
          className="flex items-center space-x-2 px-4 py-2 rounded-md bg-[var(--color-brand)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    )
  }

  const history = historyQ.data ?? []
  const forecast = forecastQ.data ?? []
  const inventory = inventoryQ.data ?? []
  const centers = centersQ.data ?? []
  const meals = mealsQ.data ?? []

  return (
    <div className="max-w-[1120px] mx-auto pb-16">
      {/* 1. Headline Insight */}
      <HeadlineInsight summary={forecast} />

      {/* 2. Hero Forecast Chart */}
      <ForecastChart history={history} forecast={forecast} />

      {/* 3. Numbers Strip */}
      <NumbersStrip summary={forecast} />

      {/* 4. Action layer: Needs Attention + Operational Read */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-4">
        <div className="lg:col-span-2">
          <NeedsAttention inventory={inventory} centers={centers} meals={meals} />
        </div>
        <div className="lg:col-span-1">
          <OperationalRead summary={forecast} />
        </div>
      </div>

      {/* 5. Secondary Context */}
      <SecondaryContext />
    </div>
  )
}