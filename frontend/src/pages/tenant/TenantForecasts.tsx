import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import {
  TrendingUp,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Search,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  Store
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts'
import { Link } from 'react-router-dom'

interface ModelEvaluation {
  model_name: string
  baseline_name: string
  test_mae: number | null
  test_rmse: number | null
  test_wape: number | null
  baseline_mae: number | null
  baseline_wape: number | null
  sufficiency_verdict: 'adequate' | 'marginal' | 'insufficient'
  training_sample_count: number
  training_start_date?: string
  training_end_date?: string
  evaluation_start_date?: string
  evaluation_end_date?: string
  comparison_summary?: string
}

interface DataSufficiency {
  verdict: 'adequate' | 'marginal' | 'insufficient'
  history_days: number
  history_weeks: number
  distinct_dates_count: number
  start_date?: string
  end_date?: string
  warning_message?: string
  is_sufficient: boolean
}

interface ItemPrediction {
  item_name: string
  category: string
  forecast_date: string
  predicted_orders: number
  prep_0pct: number
  prep_10pct: number
  prep_15pct: number
  prep_20pct: number
  model_type: string
}

interface ForecastResponse {
  run_id: string
  restaurant_id: string
  branch_id?: string
  branch_name?: string
  frequency: 'daily' | 'weekly'
  start_date: string
  end_date: string
  model_type: string
  default_buffer: number
  evaluation?: ModelEvaluation
  data_sufficiency: DataSufficiency
  historical_series: Array<{ date: string; actual_orders: number }>
  forecast_series: ItemPrediction[]
  aggregated_timeline: Array<{ date: string; predicted_orders: number }>
  category_breakdown: Record<string, number>
}

export function TenantForecasts() {
  const { currentRestaurant, branches, currentBranch, session } = useAuth()

  // Controls
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily')
  const [horizonSteps, setHorizonSteps] = useState<number>(14)
  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentBranch?.id || (branches[0]?.id || ''))
  const [activeBuffer, setActiveBuffer] = useState<0 | 10 | 15 | 20>(10)
  const [forceBaseline, setForceBaseline] = useState<boolean>(false)

  // Filtering
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [tablePage, setTablePage] = useState(1)
  const pageSize = 15

  // Data & State
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync horizon with frequency
  useEffect(() => {
    if (frequency === 'daily') {
      setHorizonSteps(14)
    } else {
      setHorizonSteps(4)
    }
  }, [frequency])

  // Fetch Forecast
  const fetchForecast = async (isManualGenerate: boolean = false) => {
    if (!currentRestaurant) return
    if (isManualGenerate) {
      setGenerating(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      if (isManualGenerate) {
        // Generate new forecast
        const res = await api.post(
          `/tenant/restaurants/${currentRestaurant.id}/forecasts/generate`,
          {
            branch_id: selectedBranchId || undefined,
            frequency,
            horizon_steps: horizonSteps,
            force_baseline: forceBaseline
          },
          { headers: { Authorization: `Bearer ${session?.access_token}` } }
        )
        setForecastData(res.data)
        if (res.data.default_buffer) {
          setActiveBuffer(res.data.default_buffer as any)
        }
      } else {
        // Fetch latest
        const branchParam = selectedBranchId ? `&branch_id=${selectedBranchId}` : ''
        const res = await api.get(
          `/tenant/restaurants/${currentRestaurant.id}/forecasts/latest?frequency=${frequency}${branchParam}`,
          { headers: { Authorization: `Bearer ${session?.access_token}` } }
        )
        if (res.data) {
          setForecastData(res.data)
          if (res.data.default_buffer) {
            setActiveBuffer(res.data.default_buffer as any)
          }
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to process demand forecast.')
    } finally {
      setLoading(false)
      setGenerating(false)
    }
  }

  useEffect(() => {
    fetchForecast(false)
  }, [currentRestaurant, selectedBranchId, frequency])

  // Save Default Buffer
  const handleSaveDefaultBuffer = async (buf: 0 | 10 | 15 | 20) => {
    if (!currentRestaurant) return
    setActiveBuffer(buf)
    setSavingSettings(true)
    try {
      await api.put(
        `/tenant/restaurants/${currentRestaurant.id}/settings`,
        { default_prep_buffer: buf, default_forecasting_frequency: frequency },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
    } catch (err) {
      console.error('Failed to update buffer settings:', err)
    } finally {
      setSavingSettings(false)
    }
  }

  // Combined Chart Series: Historical actuals + Future predictions
  const combinedChartData = useMemo(() => {
    if (!forecastData) return []
    const points: Array<{
      date: string
      actual_orders?: number
      predicted_orders?: number
      prep_target?: number
      type: 'actual' | 'forecast'
    }> = []

    // Historical
    for (const h of forecastData.historical_series || []) {
      points.push({
        date: h.date,
        actual_orders: h.actual_orders,
        type: 'actual'
      })
    }

    // Forecasted Timeline
    const mult = 1 + activeBuffer / 100
    for (const p of forecastData.aggregated_timeline || []) {
      const pred = p.predicted_orders
      const prep = Math.ceil(pred * mult)
      points.push({
        date: p.date,
        predicted_orders: pred,
        prep_target: prep,
        type: 'forecast'
      })
    }

    return points
  }, [forecastData, activeBuffer])

  // Extract Categories
  const categories = useMemo(() => {
    if (!forecastData?.forecast_series) return ['All']
    const cats = new Set<string>()
    forecastData.forecast_series.forEach(item => {
      if (item.category) cats.add(item.category)
    })
    return ['All', ...Array.from(cats).sort()]
  }, [forecastData])

  // Filtered Table Items
  const filteredPredictions = useMemo(() => {
    if (!forecastData?.forecast_series) return []
    return forecastData.forecast_series.filter(item => {
      const matchSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchCat = selectedCategory === 'All' || item.category === selectedCategory
      return matchSearch && matchCat
    })
  }, [forecastData, searchQuery, selectedCategory])

  const paginatedPredictions = useMemo(() => {
    const start = (tablePage - 1) * pageSize
    return filteredPredictions.slice(start, start + pageSize)
  }, [filteredPredictions, tablePage])

  const totalPages = Math.ceil(filteredPredictions.length / pageSize) || 1

  // Aggregate Metrics
  const totalPredictedOrders = useMemo(() => {
    if (!forecastData?.forecast_series) return 0
    return forecastData.forecast_series.reduce((sum, item) => sum + item.predicted_orders, 0)
  }, [forecastData])

  const totalPrepRequirement = useMemo(() => {
    if (!forecastData?.forecast_series) return 0
    return forecastData.forecast_series.reduce((sum, item) => {
      if (activeBuffer === 0) return sum + item.prep_0pct
      if (activeBuffer === 10) return sum + item.prep_10pct
      if (activeBuffer === 15) return sum + item.prep_15pct
      return sum + item.prep_20pct
    }, 0)
  }, [forecastData, activeBuffer])

  const formatModelLabel = (model: string) => {
    switch (model) {
      case 'ml_random_forest':
        return 'Random Forest Regressor'
      case 'ml_gradient_boosting':
        return 'Gradient Boosting (HistGB)'
      case 'ml_ridge_regression':
        return 'Ridge Regression (L2 Regularized)'
      case 'baseline_seasonal_naive':
        return 'Seasonal Naïve (Day-of-Week)'
      case 'baseline_moving_average':
        return 'Moving Average'
      default:
        return model.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Dynamic Multi-Model Forecasting Engine</span>
          </div>
          <h1 className="text-2xl font-black text-[var(--color-text)] tracking-tight">
            Demand Forecasts & Prep Target Optimization
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Adaptive machine learning predictions benchmarked against walk-forward baselines.
          </p>
        </div>

        {/* Global Action / Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Dropdown */}
          <div className="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 shadow-sm">
            <Store className="w-4 h-4 text-emerald-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id} className="bg-[var(--color-surface)] text-[var(--color-text)]">
                  {b.branch_name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={() => fetchForecast(true)}
            disabled={generating || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Training Models...' : 'Run New Forecast'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          <div>
            <span className="font-bold text-red-200">Unable to generate forecast:</span> {error}
          </div>
        </div>
      )}

      {/* Control Bar: Frequency, Horizon, Buffers */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-2xl p-4 shadow-sm">
        {/* Frequency Pill */}
        <div className="md:col-span-4 flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Forecasting Frequency
          </span>
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]">
            <button
              onClick={() => setFrequency('daily')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                frequency === 'daily'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              Daily (Day-of-Week)
            </button>
            <button
              onClick={() => setFrequency('weekly')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                frequency === 'weekly'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              Weekly Aggregate
            </button>
          </div>
        </div>

        {/* Horizon Steps */}
        <div className="md:col-span-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Horizon ({frequency === 'daily' ? 'Days' : 'Weeks'})
          </span>
          <select
            value={horizonSteps}
            onChange={(e) => setHorizonSteps(Number(e.target.value))}
            className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--color-text)] outline-none cursor-pointer"
          >
            {frequency === 'daily' ? (
              <>
                <option value={7}>Next 7 Days (1 Week)</option>
                <option value={14}>Next 14 Days (Default)</option>
                <option value={21}>Next 21 Days (3 Weeks)</option>
                <option value={30}>Next 30 Days (Full Month)</option>
              </>
            ) : (
              <>
                <option value={4}>Next 4 Weeks (Default)</option>
                <option value={8}>Next 8 Weeks (2 Months)</option>
                <option value={12}>Next 12 Weeks (Quarterly)</option>
              </>
            )}
          </select>
        </div>

        {/* Buffer Selection */}
        <div className="md:col-span-5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Kitchen Preparation Buffer
            </span>
            {savingSettings && (
              <span className="text-[10px] text-emerald-400 animate-pulse font-medium">Saving default...</span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]">
            {[0, 10, 15, 20].map((bVal) => (
              <button
                key={bVal}
                onClick={() => handleSaveDefaultBuffer(bVal as any)}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeBuffer === bVal
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                +{bVal}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Force Baseline Option Toggle */}
      <div className="flex items-center justify-between px-2 text-xs text-[var(--color-text-tertiary)]">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={forceBaseline}
            onChange={(e) => setForceBaseline(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-[var(--color-surface)] border-[var(--color-border)] cursor-pointer"
          />
          <span className="font-medium text-[var(--color-text-secondary)]">
            Force Robust Baseline (Skip ML training to conserve compute)
          </span>
        </label>
        <span className="text-[11px]">
          Target Outlet Timezone: {currentRestaurant?.timezone || 'Asia/Kolkata'}
        </span>
      </div>

      {/* Data Sufficiency Warning / Notification */}
      {forecastData?.data_sufficiency && !forecastData.data_sufficiency.is_sufficient && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5 text-amber-300">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-amber-200">
              Limited Historical Records ({forecastData.data_sufficiency.history_days} Days Observed)
            </div>
            <p className="text-amber-300/90 leading-relaxed">
              {forecastData.data_sufficiency.warning_message ||
                'A minimum of 14 days of POS order history is required to generate reliable daily predictions. Please upload additional sales records.'}
            </p>
            <div className="pt-2">
              <Link
                to="/app/upload"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold transition-all text-xs"
              >
                <span>Upload POS Records</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projected Demand */}
        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] font-bold uppercase mb-2">
            <span>Forecasted Demand</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-[var(--color-text)]">
            {Math.round(totalPredictedOrders).toLocaleString()}
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] ml-1">orders</span>
          </div>
          <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
            Across {horizonSteps} {frequency === 'daily' ? 'days' : 'weeks'} trajectory
          </div>
        </div>

        {/* Preparation Target with Buffer */}
        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] font-bold uppercase mb-2">
            <span>Prep Requirement (+{activeBuffer}%)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {Math.round(totalPrepRequirement).toLocaleString()}
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] ml-1">portions</span>
          </div>
          <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
            Buffer adds +{Math.round(totalPrepRequirement - totalPredictedOrders).toLocaleString()} units for service surge
          </div>
        </div>

        {/* Selected Model Provenance */}
        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] font-bold uppercase mb-2">
            <span>Selected Model</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-sm font-bold text-[var(--color-text)] truncate" title={forecastData?.model_type}>
            {forecastData?.model_type ? formatModelLabel(forecastData.model_type) : 'Evaluating...'}
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold mt-1">
            {forecastData?.evaluation?.sufficiency_verdict === 'adequate'
              ? 'Walk-Forward Validated ML'
              : 'Seasonal Baseline Active'}
          </div>
        </div>

        {/* Model Accuracy Benchmark (WAPE) */}
        <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] font-bold uppercase mb-2">
            <span>Holdout Error (WAPE)</span>
            <BarChart3 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-[var(--color-text)]">
            {forecastData?.evaluation?.test_wape !== undefined && forecastData?.evaluation?.test_wape !== null
              ? `${(forecastData.evaluation.test_wape * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
          <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
            Baseline WAPE:{' '}
            {forecastData?.evaluation?.baseline_wape !== undefined && forecastData?.evaluation?.baseline_wape !== null
              ? `${(forecastData.evaluation.baseline_wape * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
        </div>
      </div>

      {/* Main Trajectory Chart: Actuals vs Predicted Demand */}
      <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text)]">Demand Trajectory & Kitchen Prep Target</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Historical actuals preceding the vertical reference marker, followed by adaptive predictions with +{activeBuffer}% buffer.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              <span className="text-[var(--color-text-secondary)]">Historical Actuals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="text-[var(--color-text-secondary)]">Predicted Demand</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
              <span className="text-[var(--color-text-secondary)]">Prep Target (+{activeBuffer}%)</span>
            </div>
          </div>
        </div>

        {/* Recharts Container */}
        <div className="h-72 w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-tertiary)] animate-pulse">
              Computing trajectory...
            </div>
          ) : combinedChartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-xs text-[var(--color-text-tertiary)]">
              <BarChart3 className="w-8 h-8 opacity-30 mb-2" />
              <span>No historical demand records found for this branch.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  stroke="var(--color-text-tertiary)"
                  fontSize={11}
                  tickFormatter={(val) => {
                    const parts = String(val).split('-')
                    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : val
                  }}
                />
                <YAxis stroke="var(--color-text-tertiary)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === 'actual_orders') return [`${value} units`, 'Historical Actuals']
                    if (name === 'predicted_orders') return [`${value} units`, 'Predicted Demand']
                    if (name === 'prep_target') return [`${value} units`, `Prep Target (+${activeBuffer}%)`]
                    return [value, name]
                  }}
                />
                {forecastData?.start_date && (
                  <ReferenceLine
                    x={forecastData.start_date}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{ value: 'Forecast Horizon Start', fill: '#10b981', fontSize: 10, position: 'top' }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="actual_orders"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#actualGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="predicted_orders"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#predGrad)"
                />
                <Line
                  type="monotone"
                  dataKey="prep_target"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Model Transparency & Walk-Forward Audit */}
      {forecastData?.evaluation && (
        <div className="p-5 rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-xs space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
            <ShieldCheck className="w-4 h-4" />
            <span>Walk-Forward Validation & Model Selection Audit</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[var(--color-text-secondary)]">
            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] space-y-1">
              <span className="font-bold text-[var(--color-text)]">Selected Candidate</span>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {formatModelLabel(forecastData.evaluation.model_name)}
              </p>
              <div className="text-[10px] text-emerald-400 font-medium pt-1">
                {forecastData.evaluation.comparison_summary}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] space-y-1">
              <span className="font-bold text-[var(--color-text)]">Chronological Holdout</span>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Training: {forecastData.evaluation.training_start_date || 'N/A'} to{' '}
                {forecastData.evaluation.training_end_date || 'N/A'}
              </p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">
                Evaluated: {forecastData.evaluation.evaluation_start_date || 'N/A'} to{' '}
                {forecastData.evaluation.evaluation_end_date || 'N/A'} (Zero Leakage)
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] space-y-1">
              <span className="font-bold text-[var(--color-text)]">Error Metrics (Holdout)</span>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span>MAE: {forecastData.evaluation.test_mae?.toFixed(2) || 'N/A'}</span>
                <span>RMSE: {forecastData.evaluation.test_rmse?.toFixed(2) || 'N/A'}</span>
                <span className="font-bold text-emerald-400">
                  WAPE: {(forecastData.evaluation.test_wape! * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Item Forecasts Table & Filters */}
      <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text)]">Item-Level Demand Predictions</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Specific dish predictions and preparation buffers. Active column reflects +{activeBuffer}% buffer target.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search dish name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setTablePage(1)
                }}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-xs text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] outline-none w-48"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setTablePage(1)
              }}
              className="px-3 py-1.5 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text)] outline-none cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-subtle)]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] text-[var(--color-text-tertiary)] uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-4">Menu Item</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Forecast Date</th>
                <th className="py-3 px-3 text-right">Raw Forecast (ŷ)</th>
                <th className={`py-3 px-3 text-right ${activeBuffer === 0 ? 'bg-emerald-500/15 text-emerald-400 font-black' : ''}`}>
                  Target (0%)
                </th>
                <th className={`py-3 px-3 text-right ${activeBuffer === 10 ? 'bg-emerald-500/15 text-emerald-400 font-black' : ''}`}>
                  Target (10%)
                </th>
                <th className={`py-3 px-3 text-right ${activeBuffer === 15 ? 'bg-emerald-500/15 text-emerald-400 font-black' : ''}`}>
                  Target (15%)
                </th>
                <th className={`py-3 px-3 text-right ${activeBuffer === 20 ? 'bg-emerald-500/15 text-emerald-400 font-black' : ''}`}>
                  Target (20%)
                </th>
                <th className="py-3 px-4 text-center">Model Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)] font-medium">
              {paginatedPredictions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-[var(--color-text-tertiary)]">
                    No matching item predictions found.
                  </td>
                </tr>
              ) : (
                paginatedPredictions.map((row, idx) => (
                  <tr key={`${row.item_name}-${row.forecast_date}-${idx}`} className="hover:bg-[var(--color-surface-alt)]/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-[var(--color-text)]">
                      {row.item_name}
                    </td>
                    <td className="py-3 px-3 text-[var(--color-text-secondary)]">
                      <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)] text-[10px]">
                        {row.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[var(--color-text-secondary)]">
                      {row.forecast_date}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[var(--color-text)]">
                      {row.predicted_orders.toFixed(1)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${activeBuffer === 0 ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-[var(--color-text-secondary)]'}`}>
                      {row.prep_0pct}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${activeBuffer === 10 ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-[var(--color-text-secondary)]'}`}>
                      {row.prep_10pct}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${activeBuffer === 15 ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-[var(--color-text-secondary)]'}`}>
                      {row.prep_15pct}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${activeBuffer === 20 ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-[var(--color-text-secondary)]'}`}>
                      {row.prep_20pct}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                        {row.model_type.replace('ml_', '').replace('baseline_', '')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] pt-2">
          <span>
            Showing {paginatedPredictions.length} of {filteredPredictions.length} predictions
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTablePage(p => Math.max(1, p - 1))}
              disabled={tablePage === 1}
              className="px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="font-semibold text-[var(--color-text-secondary)] px-2">
              Page {tablePage} of {totalPages}
            </span>
            <button
              onClick={() => setTablePage(p => Math.min(totalPages, p + 1))}
              disabled={tablePage === totalPages}
              className="px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
