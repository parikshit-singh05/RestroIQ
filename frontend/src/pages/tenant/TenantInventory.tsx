import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAppContext, type BufferValue } from '../../context/AppContext'
import { api } from '../../lib/api'
import {
  Package,
  Search,
  Download,
  AlertCircle,
  Info,
  Calendar,
  CheckCircle2,
  RefreshCw
} from 'lucide-react'

interface InventoryItem {
  item_name: string
  category: string
  predicted_units: number
  prep_0pct: number
  prep_10pct: number
  prep_15pct: number
  prep_20pct: number
  demand_tier: 'high' | 'normal' | 'low'
  historical_daily_avg: number
}

interface ForecastVsActual {
  date: string
  item_name: string
  category: string
  forecasted: number
  actual: number
  variance: number
  variance_pct: number
}

interface InventoryResponse {
  restaurant_id: string
  branch_id?: string
  branch_name?: string
  forecast_run_id?: string
  frequency: string
  forecast_start_date?: string
  forecast_end_date?: string
  default_buffer: number
  total_predicted_units: number
  prep_targets_summary: {
    prep_0: number
    prep_10: number
    prep_15: number
    prep_20: number
  }
  items: InventoryItem[]
  forecast_vs_actual: ForecastVsActual[]
  inventory_tracking_disclaimer: string
}

export function TenantInventory() {
  const { currentRestaurant, currentBranch, session } = useAuth()
  const { buffer: globalBuffer, setBuffer } = useAppContext()

  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily')
  const [selectedBuffer, setSelectedBuffer] = useState<BufferValue>(globalBuffer || 10)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<InventoryResponse | null>(null)

  const fetchInventory = async () => {
    if (!currentRestaurant) return
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (currentBranch) params.append('branch_id', currentBranch.id)
      params.append('frequency', frequency)
      if (search) params.append('search', search)
      if (selectedCategory && selectedCategory !== 'All') params.append('category', selectedCategory)

      const res = await api.get(`/tenant/restaurants/${currentRestaurant.id}/inventory?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      setData(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load predictive inventory planning.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInventory()
  }, [currentRestaurant?.id, currentBranch?.id, frequency, selectedCategory])

  const handleBufferChange = (b: BufferValue) => {
    setSelectedBuffer(b)
    setBuffer(b)
  }

  const getTargetValue = (item: InventoryItem) => {
    switch (selectedBuffer) {
      case 0:
        return item.prep_0pct
      case 10:
        return item.prep_10pct
      case 15:
        return item.prep_15pct
      case 20:
        return item.prep_20pct
      default:
        return item.prep_10pct
    }
  }

  const getSummaryTarget = () => {
    if (!data?.prep_targets_summary) return 0
    switch (selectedBuffer) {
      case 0:
        return data.prep_targets_summary.prep_0
      case 10:
        return data.prep_targets_summary.prep_10
      case 15:
        return data.prep_targets_summary.prep_15
      case 20:
        return data.prep_targets_summary.prep_20
      default:
        return data.prep_targets_summary.prep_10
    }
  }

  const exportCSV = () => {
    if (!data || !data.items.length) return
    const headers = ['Item Name', 'Category', 'Predicted Demand', 'Target Prep (Selected)', 'Prep 0%', 'Prep 10%', 'Prep 15%', 'Prep 20%', 'Demand Tier', 'Historical Daily Avg']
    const rows = data.items.map(item => [
      `"${item.item_name}"`,
      `"${item.category}"`,
      item.predicted_units,
      getTargetValue(item),
      item.prep_0pct,
      item.prep_10pct,
      item.prep_15pct,
      item.prep_20pct,
      item.demand_tier,
      item.historical_daily_avg
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `RestroIQ_PrepPlan_${currentRestaurant?.name || 'Restaurant'}_${frequency}_${selectedBuffer}pct.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const categories = ['All', ...Array.from(new Set(data?.items.map(i => i.category) || []))]

  const filteredItems = (data?.items || []).filter(item => {
    const matchesSearch = !search || item.item_name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase())
    const matchesCat = selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase()
    return matchesSearch && matchesCat
  })

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-black tracking-tight text-[var(--color-text)]">
              Kitchen Preparation & Safety Buffers
            </h1>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Predictive Ops
            </span>
          </div>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            Dynamic portion planning derived from AI multi-model demand forecasts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={exportCSV}
            disabled={!data || !data.items.length}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Prep Sheet (CSV)</span>
          </button>
        </div>
      </div>

      {/* Honest Inventory Disclaimer Banner */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-start gap-3 text-[12px]">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-bold">Inventory Planning Scope: </span>
          <span>
            {data?.inventory_tracking_disclaimer ||
              'Physical warehouse stock balances and waste tracking require active ERP inventory sync. Displaying predictive kitchen batch preparation requirements based on demand forecasts.'}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 text-[12px]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls Bar: Frequency & Buffer Selectors */}
      <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
        {/* Frequency Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Planning Cycle
          </span>
          <div className="flex items-center bg-[var(--color-surface-alt)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
            <button
              onClick={() => setFrequency('daily')}
              className={`px-3 py-1 text-[12px] font-semibold rounded-md transition-all cursor-pointer ${
                frequency === 'daily'
                  ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              Daily (14-Day)
            </button>
            <button
              onClick={() => setFrequency('weekly')}
              className={`px-3 py-1 text-[12px] font-semibold rounded-md transition-all cursor-pointer ${
                frequency === 'weekly'
                  ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              Weekly (4-Week)
            </button>
          </div>
        </div>

        {/* Safety Buffer Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Active Safety Margin
          </span>
          <div className="flex items-center bg-[var(--color-surface-alt)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
            {([0, 10, 15, 20] as BufferValue[]).map(b => (
              <button
                key={b}
                onClick={() => handleBufferChange(b)}
                className={`px-3 py-1 text-[12px] font-semibold rounded-md transition-all cursor-pointer ${
                  selectedBuffer === b
                    ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-sm font-bold border border-[var(--color-border)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                +{b}%
              </button>
            ))}
          </div>
        </div>

        {/* Forecast Window Badge */}
        {data?.forecast_start_date && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
            <span>Horizon: {data.forecast_start_date} to {data.forecast_end_date}</span>
          </div>
        )}
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
            Base Demand (0% Buffer)
          </span>
          <div className="text-2xl font-heading font-black text-[var(--color-text)] mt-1">
            {data?.prep_targets_summary.prep_0.toLocaleString() || '0'}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block">
            Raw forecasted consumption units
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Target Batch Requirement
            </span>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
              +{selectedBuffer}% Buffer
            </span>
          </div>
          <div className="text-2xl font-heading font-black text-emerald-500 mt-1">
            {getSummaryTarget().toLocaleString()}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block">
            +{getSummaryTarget() - (data?.prep_targets_summary.prep_0 || 0)} safety buffer units
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
            Max Surge Ceiling (+20%)
          </span>
          <div className="text-2xl font-heading font-black text-[var(--color-text)] mt-1">
            {data?.prep_targets_summary.prep_20.toLocaleString() || '0'}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block">
            Full peak volatility coverage
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
            Active Menu Items Planned
          </span>
          <div className="text-2xl font-heading font-black text-[var(--color-text)] mt-1">
            {data?.items.length || '0'}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 block">
            Across {categories.length - 1} categories
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-grow max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            placeholder="Search dish or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[12px] text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-bold uppercase text-[var(--color-text-tertiary)] whitespace-nowrap">
            Category:
          </span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Preparation Table */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)] text-[var(--color-text-secondary)] font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Menu Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Predicted Demand</th>
                <th className="py-3 px-4 text-right bg-emerald-500/5 text-emerald-400 font-bold">
                  Target Prep (+{selectedBuffer}%)
                </th>
                <th className="py-3 px-4 text-right text-[var(--color-text-tertiary)]">Prep 0%</th>
                <th className="py-3 px-4 text-right text-[var(--color-text-tertiary)]">Prep 10%</th>
                <th className="py-3 px-4 text-right text-[var(--color-text-tertiary)]">Prep 15%</th>
                <th className="py-3 px-4 text-right text-[var(--color-text-tertiary)]">Surge 20%</th>
                <th className="py-3 px-4 text-center">Velocity Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--color-text-tertiary)]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--color-accent)]" />
                    <span>Calculating preparation requirements...</span>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--color-text-tertiary)]">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold">No preparation items found</p>
                    <p className="text-[11px] mt-0.5">
                      {search || selectedCategory !== 'All'
                        ? 'Try clearing search or category filters.'
                        : 'Upload POS operational data and generate a demand forecast first.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const target = getTargetValue(item)
                  return (
                    <tr key={item.item_name} className="hover:bg-[var(--color-surface-alt)]/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[var(--color-text)]">
                        {item.item_name}
                      </td>
                      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                        {item.category}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {item.predicted_units.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400 bg-emerald-500/5">
                        {target} portions
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--color-text-secondary)]">
                        {item.prep_0pct}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--color-text-secondary)]">
                        {item.prep_10pct}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--color-text-secondary)]">
                        {item.prep_15pct}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--color-text-secondary)]">
                        {item.prep_20pct}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            item.demand_tier === 'high'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : item.demand_tier === 'low'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
                          }`}
                        >
                          {item.demand_tier === 'high' ? 'High Surge' : item.demand_tier === 'low' ? 'Low Velocity' : 'Steady'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Forecast vs Actual Validation Card */}
      {data?.forecast_vs_actual && data.forecast_vs_actual.length > 0 && (
        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-[var(--color-text)]">
                Forecast vs. Actual Past Consumption Audit
              </h3>
            </div>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              Historical overlap verification
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text-tertiary)] uppercase text-[9px]">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3 text-right">Forecasted</th>
                  <th className="py-2 px-3 text-right">Actual Sold</th>
                  <th className="py-2 px-3 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {data.forecast_vs_actual.slice(0, 5).map((f, i) => (
                  <tr key={i} className="hover:bg-[var(--color-surface-alt)]/40">
                    <td className="py-2 px-3">{f.date}</td>
                    <td className="py-2 px-3 font-medium text-[var(--color-text)]">{f.item_name}</td>
                    <td className="py-2 px-3 text-right">{f.forecasted}</td>
                    <td className="py-2 px-3 text-right font-semibold">{f.actual}</td>
                    <td className={`py-2 px-3 text-right font-bold ${f.variance >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {f.variance > 0 ? `+${f.variance}` : f.variance} ({f.variance_pct}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

