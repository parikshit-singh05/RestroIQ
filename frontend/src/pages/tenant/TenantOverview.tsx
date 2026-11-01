import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import {
  TrendingUp,
  ShoppingBag,
  IndianRupee,
  Calendar,
  UploadCloud,
  Database,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  BarChart2
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface TopItem {
  item_name: string
  category: string
  total_quantity: number
  total_revenue: number
  daily_average: number
}

interface DailyPoint {
  date: string
  total_orders: number
  units_sold: number
}

interface SummaryData {
  total_line_items: number
  total_orders: number
  total_sales: number
  currency_symbol: string
  start_date: string | null
  end_date: string | null
  total_days: number
  unique_items_count: number
  active_branches_count: number
  data_sufficiency: 'adequate' | 'marginal' | 'insufficient'
  top_items: TopItem[]
  daily_velocity: DailyPoint[]
}

export function TenantOverview() {
  const { currentRestaurant, currentBranch, session } = useAuth()
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = async () => {
    if (!currentRestaurant) return
    setLoading(true)
    setError(null)

    try {
      const url = currentBranch
        ? `/tenant/restaurants/${currentRestaurant.id}/orders/summary?branch_id=${currentBranch.id}`
        : `/tenant/restaurants/${currentRestaurant.id}/orders/summary`

      const res = await api.get(url, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      setSummary(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch tenant overview.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [currentRestaurant?.id, currentBranch?.id])

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-[var(--color-text-tertiary)]">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
        <span className="text-[13px] font-medium">Loading operational intelligence...</span>
      </div>
    )
  }

  const hasData = summary && summary.total_line_items > 0

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              {currentRestaurant?.name || 'Restaurant Workspace'}
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Live Operations
            </span>
          </div>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            {currentBranch ? `Outlet: ${currentBranch.branch_name} (${currentBranch.city})` : 'Network-wide demand intelligence'} &bull; Base Currency: {currentRestaurant?.currency || 'INR'} ({summary?.currency_symbol || '₹'})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/app/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload POS Data</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
          {error}
        </div>
      )}

      {/* Empty State when no POS data has been ingested yet */}
      {!hasData ? (
        <div className="border border-[var(--color-border)] rounded-3xl p-10 sm:p-14 text-center bg-[var(--color-surface)] shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-[var(--color-text)]">
            Welcome to your RestroIQ Workspace!
          </h2>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-2 max-w-lg mx-auto leading-relaxed">
            Upload your POS order exports (CSV or Excel) to generate automated item-level demand forecasts, kitchen safety buffers (0%, 10%, 15%, 20%), and velocity analysis.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/app/upload"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold transition-all shadow-md shadow-emerald-600/20"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload My POS Sales File</span>
            </Link>

            <Link
              to="/app/upload"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] text-[13px] font-semibold transition-all"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Load Pre-Packaged Sample Data</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Headline Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
              <div className="flex items-center justify-between text-[var(--color-text-tertiary)]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Gross Sales</span>
                <IndianRupee className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-[var(--color-text)] mt-2">
                {summary.currency_symbol}{summary.total_sales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                Across {summary.total_orders.toLocaleString()} distinct orders
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
              <div className="flex items-center justify-between text-[var(--color-text-tertiary)]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Line Items</span>
                <ShoppingBag className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-[var(--color-text)] mt-2">
                {summary.total_line_items.toLocaleString()}
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                {summary.unique_items_count} unique dishes cataloged
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
              <div className="flex items-center justify-between text-[var(--color-text-tertiary)]">
                <span className="text-[11px] font-bold uppercase tracking-wider">History Horizon</span>
                <Calendar className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-[var(--color-text)] mt-2">
                {summary.total_days} Days
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                {summary.start_date} to {summary.end_date}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
              <div className="flex items-center justify-between text-[var(--color-text-tertiary)]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Data Sufficiency</span>
                {summary.data_sufficiency === 'adequate' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <div className="text-lg font-bold capitalize mt-2 flex items-center gap-2">
                <span className={summary.data_sufficiency === 'adequate' ? 'text-emerald-400' : 'text-amber-400'}>
                  {summary.data_sufficiency}
                </span>
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                {summary.data_sufficiency === 'adequate'
                  ? '>=12 weeks. ML & Seasonal ready'
                  : '4-12 weeks. Statistical baseline ready'}
              </div>
            </div>
          </div>

          {/* Velocity Trend Chart */}
          {summary.daily_velocity.length > 0 && (
            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Daily Transaction & Order Velocity</span>
                  </h3>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                    Order volume trends highlighting day-of-week seasonality (weekend surges).
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.daily_velocity}>
                    <defs>
                      <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
                      tickLine={false}
                      stroke="var(--color-border)"
                    />
                    <YAxis
                      tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }}
                      tickLine={false}
                      stroke="var(--color-border)"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        borderRadius: '0.75rem',
                        fontSize: '12px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_orders"
                      name="Orders"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#orderGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Selling Menu Items Table */}
          {summary.top_items.length > 0 && (
            <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <span>Top Demand Velocity Dishes</span>
                  </h3>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                    Highest volume items ranked by total units ordered and daily velocity.
                  </p>
                </div>

                <Link
                  to="/app/forecasts"
                  className="text-[12px] font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>Generate Forecasts</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--color-border-subtle)] text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Menu Item</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Total Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Daily Avg</th>
                      <th className="py-2.5 px-3 text-right">Net Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {summary.top_items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[var(--color-surface-alt)]/40 transition-colors">
                        <td className="py-3 px-3 font-semibold text-[var(--color-text)]">
                          {item.item_name}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[var(--color-text)]">
                          {item.total_quantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[var(--color-text-secondary)]">
                          {item.daily_average}/day
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          {summary.currency_symbol}{item.total_revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
