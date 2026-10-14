import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCenters, getDetailedForecasts, getCentersAnalysis } from '../lib/api'
import { DetailChart } from '../components/shared/DetailChart'
import { ForecastTable } from '../components/forecasts/ForecastTable'
import { useAppContext } from '../context/AppContext'
import { formatCompact } from '../lib/format'
import { ArrowLeft, Building2, MapPin } from 'lucide-react'

export function CenterDetail() {
  const { id } = useParams()
  const { buffer } = useAppContext()
  const bufferPct = buffer / 100

  const centersQuery = useQuery({ queryKey: ['centers'], queryFn: getCenters, staleTime: 5 * 60 * 1000 })
  const analysisQuery = useQuery({ queryKey: ['centers_analysis'], queryFn: getCentersAnalysis, staleTime: 5 * 60 * 1000 })
  const forecastQuery = useQuery({
    queryKey: ['forecast_center', id],
    queryFn: () => getDetailedForecasts({ center_id: Number(id), limit: 5000 }),
    staleTime: 5 * 60 * 1000
  })

  if (centersQuery.isLoading || forecastQuery.isLoading || analysisQuery.isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[13px] font-medium text-[var(--color-text-tertiary)] p-12">
        Loading center details...
      </div>
    )
  }

  const centerInfo = centersQuery.data?.find((c: any) => String(c.center_id) === id)
  const centerAnalysis = analysisQuery.data?.find((c: any) => String(c.center_id) === id)
  const center = centerInfo || centerAnalysis

  if (!center) {
    return (
      <div className="p-8 text-center text-[13px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
        Center not found.
      </div>
    )
  }

  const centerForecasts = forecastQuery.data?.filter(f => String(f.center_id) === id) || []
  const centerHistory = centerAnalysis?.historical_trajectory || []
  const centerWeekly = centerAnalysis?.weekly_trajectory || centerForecasts

  const totalDemand = centerAnalysis?.predicted_orders ?? centerForecasts.reduce((s, f) => s + f.predicted_orders, 0)
  const distinctMeals = centerForecasts.length > 0
    ? new Set(centerForecasts.map(f => f.meal_id)).size
    : (centerAnalysis?.top_meals?.length ?? 0)

  const hasHistory = centerHistory.length > 0
  const chartTitle = "10-Week Demand Trajectory"
  const chartSubtitle = hasHistory
    ? `Historical actuals (W136–W145) vs predicted orders (W146–W155) for Center ${center.center_id} (${center.simulated_city})`
    : `Predicted weekly demand trajectory (W146–W155) for Center ${center.center_id} (${center.simulated_city})`

  return (
    <div className="w-full pb-16 animate-in fade-in duration-500">
      <Link to="/centers" className="inline-flex items-center text-[12px] font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors mb-6">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Directory
      </Link>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 lg:p-8 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-5">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center shadow-md">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-[28px] lg:text-[36px] tracking-tight text-[var(--color-text)] leading-none mb-2">Center {center.center_id}</h1>
            <div className="flex items-center space-x-4">
              <span className="flex items-center text-[13px] font-bold text-[var(--color-text-secondary)]">
                <MapPin className="w-4 h-4 mr-1.5 text-[var(--color-text-tertiary)]" /> {center.simulated_city}
              </span>
              <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
              <span className="text-[13px] font-bold text-[var(--color-text-secondary)]">Type: {center.center_type}</span>
              {center.op_area && (
                <>
                  <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                  <span className="text-[13px] font-bold text-[var(--color-text-secondary)]">Op Area: {center.op_area} km²</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-[var(--color-surface-alt)] px-5 py-3 rounded-xl border border-[var(--color-border)] text-center min-w-[120px]">
            <div className="text-[20px] font-heading font-bold text-[var(--color-text)] tabular-nums leading-none mb-1">{formatCompact(totalDemand)}</div>
            <div className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">10-Wk Demand</div>
          </div>
          <div className="bg-[var(--color-surface-alt)] px-5 py-3 rounded-xl border border-[var(--color-border)] text-center min-w-[120px]">
            <div className="text-[20px] font-heading font-bold text-[var(--color-text)] tabular-nums leading-none mb-1">{distinctMeals}</div>
            <div className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Unique Meals</div>
          </div>
        </div>
      </div>

      <DetailChart
        history={centerHistory}
        forecast={centerWeekly}
        title={chartTitle}
        subtitle={chartSubtitle}
        bufferPct={bufferPct}
      />

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[18px] font-heading font-bold tracking-tight text-[var(--color-text)]">Center Forecast Manifest</h3>
      </div>
      <ForecastTable data={centerForecasts} />
    </div>
  )
}
