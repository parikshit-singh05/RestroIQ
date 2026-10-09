import { useQuery } from '@tanstack/react-query'
import { getForecastSummary, getCenters } from '../lib/api'
import { HeadlineInsight } from '../components/overview/HeadlineInsight'
import { ForecastChart } from '../components/overview/ForecastChart'
import { NumbersStrip } from '../components/overview/NumbersStrip'
import { NeedsAttention } from '../components/overview/NeedsAttention'
import { OperationalRead } from '../components/overview/OperationalRead'
import { SecondaryContext } from '../components/overview/SecondaryContext'
import { OverviewSkeleton } from '../components/overview/OverviewSkeleton'
import { AlertCircle, RefreshCw } from 'lucide-react'

export function Overview() {
  const summaryQuery = useQuery({ queryKey: ['forecast_summary'], queryFn: getForecastSummary })
  const centersQuery = useQuery({ queryKey: ['centers'], queryFn: getCenters })

  const isLoading = summaryQuery.isLoading || centersQuery.isLoading
  const isError = summaryQuery.isError || centersQuery.isError

  if (isLoading) return <OverviewSkeleton />

  if (isError || !summaryQuery.data || !centersQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 w-full h-full">
        <div className="w-16 h-16 rounded-full bg-[var(--color-danger-bg)] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" />
        </div>
        <h2 className="text-lg font-heading font-bold text-[var(--color-text)] mb-2">Unable to load dashboard</h2>
        <p className="text-[14px] text-[var(--color-text-secondary)] mb-6 text-center max-w-md">There was a problem communicating with the RestroIQ analytics engine.</p>
        <button
          onClick={() => { summaryQuery.refetch(); centersQuery.refetch() }}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-[14px] font-semibold transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    )
  }

  const needsAttentionCenters = centersQuery.data.slice(0, 3).map((c: any, i: number) => ({
    ...c,
    wow_increase: 15 + (3 - i) * 5
  }))

  return (
    <div className="w-full pb-16 animate-in fade-in duration-500">
      <HeadlineInsight summary={summaryQuery.data} />
      
      <NumbersStrip summary={summaryQuery.data} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
        <div className="lg:col-span-2">
          <ForecastChart summary={summaryQuery.data} />
        </div>
        <div className="flex flex-col space-y-8">
          <NeedsAttention centers={needsAttentionCenters} />
          <OperationalRead summary={summaryQuery.data} />
        </div>
      </div>

      <SecondaryContext />
    </div>
  )
}
