import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import {
  TrendingUp,
  ShoppingBag,
  IndianRupee,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Building2,
  Tag,
  BarChart3
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface TimelinePoint {
  date: string
  revenue: number
  orders: number
  units_sold: number
}

interface CategorySales {
  category: string
  revenue: number
  quantity: number
  percentage: number
}

interface TopItem {
  item_name: string
  category: string
  quantity: number
  revenue: number
  average_unit_price: number
}

interface SlowItem {
  item_name: string
  category: string
  quantity: number
  revenue: number
  days_since_last_sale: number
}

interface BranchComparison {
  branch_id: string
  branch_name: string
  city: string
  total_revenue: number
  total_orders: number
  average_order_value: number
}

interface DOWDistribution {
  day_name: string
  day_index: number
  orders: number
  revenue: number
}

interface PromotionAnalysis {
  has_promotions: boolean
  promo_orders_count: number
  promo_revenue: number
  regular_orders_count: number
  regular_revenue: number
  promo_aov: number
  regular_aov: number
  promo_share_pct: number
}

interface ModelAccuracy {
  model_name: string
  baseline_name: string
  test_mae: number | null
  test_rmse: number | null
  test_wape: number | null
  sufficiency_verdict: string
  evaluation_window: string | null
}

interface AnalyticsResponse {
  restaurant_id: string
  branch_id?: string
  currency: string
  currency_symbol: string
  total_revenue: number
  total_orders: number
  average_order_value: number
  total_units_sold: number
  timeline: TimelinePoint[]
  category_distribution: CategorySales[]
  top_selling_items: TopItem[]
  slow_moving_items: SlowItem[]
  branch_comparison: BranchComparison[]
  day_of_week_distribution: DOWDistribution[]
  promotion_analysis: PromotionAnalysis
  model_accuracy: ModelAccuracy | null
  data_sufficiency: 'adequate' | 'marginal' | 'insufficient'
}

export function TenantAnalytics() {
  const { currentRestaurant, currentBranch, session } = useAuth()

  const [dateRange, setDateRange] = useState<'30d' | '60d' | 'all'>('30d')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)

  const fetchAnalytics = async () => {
    if (!currentRestaurant) return
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (currentBranch) params.append('branch_id', currentBranch.id)
      if (selectedCategory && selectedCategory !== 'All') params.append('category', selectedCategory)

      if (dateRange !== 'all') {
        const days = dateRange === '30d' ? 30 : 60
        const d = new Date()
        d.setDate(d.getDate() - days)
        params.append('start_date', d.toISOString().split('T')[0])
      }

      const res = await api.get(`/tenant/restaurants/${currentRestaurant.id}/analytics?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      setAnalytics(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch restaurant analytics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [currentRestaurant?.id, currentBranch?.id, dateRange, selectedCategory])

  const symbol = analytics?.currency_symbol || '₹'

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-black tracking-tight text-[var(--color-text)]">
              Operational Analytics
            </h1>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Verified POS Data
            </span>
          </div>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            Sales volume, revenue performance, day-of-week trends, and AI model evaluation metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date range filter */}
          <div className="flex items-center bg-[var(--color-surface-alt)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
            {(['30d', '60d', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  dateRange === range
                    ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-sm font-bold border border-[var(--color-border)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                {range === '30d' ? 'Last 30 Days' : range === '60d' ? 'Last 60 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 text-[12px]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            <span>Net Sales Revenue</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-heading font-black text-[var(--color-text)] mt-1">
            {symbol} {analytics?.total_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block">
            Across {analytics?.timeline.length || 0} active operating days
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            <span>Total Orders Fulfilled</span>
            <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-heading font-black text-[var(--color-text)] mt-1">
            {analytics?.total_orders.toLocaleString() || '0'}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block">
            {analytics?.total_units_sold.toLocaleString() || '0'} total dish portions sold
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            <span>Average Order Value</span>
            <Percent className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-heading font-black text-[var(--color-text)] mt-1">
            {symbol} {analytics?.average_order_value.toFixed(2) || '0.00'}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block">
            Strict net sales per distinct ticket
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            <span>Forecast Model Accuracy</span>
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-heading font-black text-emerald-400 mt-1">
            {analytics?.model_accuracy?.test_wape != null
              ? `${(analytics.model_accuracy.test_wape * 100).toFixed(1)}% WAPE`
              : 'Evaluated'}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block truncate">
            {analytics?.model_accuracy?.model_name || 'Walk-forward baseline'}
          </span>
        </div>
      </div>

      {/* Main Revenue & Order Timeline Chart */}
      <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text)]">
              Operational Sales & Demand Trajectory
            </h2>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              Continuous chronological actuals recorded from POS receipts
            </p>
          </div>

          <div className="flex items-center bg-[var(--color-surface-alt)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
            <button
              onClick={() => setChartMetric('revenue')}
              className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                chartMetric === 'revenue'
                  ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              Revenue ({symbol})
            </button>
            <button
              onClick={() => setChartMetric('orders')}
              className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                chartMetric === 'orders'
                  ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              Order Count
            </button>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-[12px] text-[var(--color-text-tertiary)] animate-pulse">
              Loading sales trajectory...
            </div>
          ) : !analytics?.timeline || analytics.timeline.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[12px] text-[var(--color-text-tertiary)]">
              <Calendar className="w-8 h-8 opacity-30 mb-2" />
              <span>No sales data found for the selected filter period.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-text-tertiary)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickFormatter={val => val.slice(5)}
                />
                <YAxis
                  stroke="var(--color-text-tertiary)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => (chartMetric === 'revenue' ? `${symbol}${val}` : val)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: 'var(--color-text)'
                  }}
                  formatter={(val: any) => [
                    chartMetric === 'revenue' ? `${symbol} ${Number(val).toLocaleString()}` : `${val} tickets`,
                    chartMetric === 'revenue' ? 'Revenue' : 'Orders'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#analyticsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Two Column Section: Day of Week Distribution & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of Week Demand Distribution */}
        <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text)]">
              Day-of-Week Sales Distribution
            </h3>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              Reveals weekly cyclical peaks and kitchen prep staffing bottlenecks
            </p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.day_of_week_distribution || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                <XAxis dataKey="day_name" stroke="var(--color-text-tertiary)" fontSize={10} tickLine={false} />
                <YAxis
                  stroke="var(--color-text-tertiary)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `${symbol}${val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: 'var(--color-text)'
                  }}
                  formatter={(val: any) => [`${symbol} ${Number(val).toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category-Wise Distribution */}
        <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text)]">
              Category Sales Contribution
            </h3>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              Share of wallet across culinary menu sections
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {(!analytics?.category_distribution || analytics.category_distribution.length === 0) ? (
              <p className="text-[12px] text-[var(--color-text-tertiary)] text-center py-8">
                No category sales recorded yet.
              </p>
            ) : (
              analytics.category_distribution.map(cat => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[var(--color-text)]">{cat.category}</span>
                    <span className="text-[var(--color-text-secondary)]">
                      {symbol} {cat.revenue.toLocaleString()} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Two Column Section: Top Performers & Slow-Moving Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--color-text)]">
              Top-Selling Menu Drivers
            </h3>
            <span className="text-[10px] text-emerald-400 font-bold uppercase">Volume Leaders</span>
          </div>

          <div className="divide-y divide-[var(--color-border-subtle)] text-[12px]">
            {(!analytics?.top_selling_items || analytics.top_selling_items.length === 0) ? (
              <p className="py-6 text-center text-[var(--color-text-tertiary)]">No items recorded</p>
            ) : (
              analytics.top_selling_items.slice(0, 5).map((it, idx) => (
                <div key={it.item_name} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-[var(--color-text)]">{it.item_name}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">{it.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[var(--color-text)]">{it.quantity} sold</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">{symbol} {it.revenue.toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Slow-Moving Menu Items */}
        <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--color-text)]">
              Low-Velocity Menu Items
            </h3>
            <span className="text-[10px] text-amber-400 font-bold uppercase">Needs Review</span>
          </div>

          <div className="divide-y divide-[var(--color-border-subtle)] text-[12px]">
            {(!analytics?.slow_moving_items || analytics.slow_moving_items.length === 0) ? (
              <p className="py-6 text-center text-[var(--color-text-tertiary)]">No slow-moving items</p>
            ) : (
              analytics.slow_moving_items.slice(0, 5).map(it => (
                <div key={it.item_name} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[var(--color-text)]">{it.item_name}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">{it.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-amber-400">{it.quantity} sold total</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">
                      {it.days_since_last_sale > 0 ? `${it.days_since_last_sale}d since last order` : 'Recent'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Promotion Impact Card */}
      {analytics?.promotion_analysis && (
        <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-[var(--color-text)]">
                Promotion & Discount Effectiveness
              </h3>
            </div>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              Campaign uplift vs standard full-price orders
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-3.5 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)]">
              <span className="text-[10px] font-bold uppercase text-[var(--color-text-tertiary)] block">
                Promo Revenue Share
              </span>
              <p className="text-xl font-bold text-[var(--color-text)] mt-1">
                {analytics.promotion_analysis.promo_share_pct}%
              </p>
              <span className="text-[10px] text-[var(--color-text-secondary)]">
                {symbol} {analytics.promotion_analysis.promo_revenue.toLocaleString()} promotional sales
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)]">
              <span className="text-[10px] font-bold uppercase text-[var(--color-text-tertiary)] block">
                Promotional AOV
              </span>
              <p className="text-xl font-bold text-purple-400 mt-1">
                {symbol} {analytics.promotion_analysis.promo_aov.toFixed(2)}
              </p>
              <span className="text-[10px] text-[var(--color-text-secondary)]">
                {analytics.promotion_analysis.promo_orders_count} promotional tickets
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)]">
              <span className="text-[10px] font-bold uppercase text-[var(--color-text-tertiary)] block">
                Regular Ticket AOV
              </span>
              <p className="text-xl font-bold text-[var(--color-text)] mt-1">
                {symbol} {analytics.promotion_analysis.regular_aov.toFixed(2)}
              </p>
              <span className="text-[10px] text-[var(--color-text-secondary)]">
                {analytics.promotion_analysis.regular_orders_count} full-price tickets
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

