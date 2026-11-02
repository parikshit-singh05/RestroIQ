import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import {
  UtensilsCrossed,
  Search,
  Plus,
  Edit3,
  TrendingUp,
  Flame,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Package,
  Shield
} from 'lucide-react'

interface MenuItemDetail {
  id: string
  restaurant_id: string
  item_name: string
  category: string
  sku?: string | null
  introduced_date?: string | null
  discontinued_date?: string | null
  is_active: boolean
  total_historical_units: number
  total_revenue: number
  average_price: number
  demand_velocity: 'high' | 'steady' | 'slow'
  latest_forecast_demand: number
}

interface MenuCatalogResponse {
  restaurant_id: string
  categories: string[]
  total_items: number
  items: MenuItemDetail[]
}

export function TenantMenu() {
  const { currentRestaurant, session, userRole } = useAuth()
  const [catalog, setCatalog] = useState<MenuCatalogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedVelocity, setSelectedVelocity] = useState<string>('all')

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItemDetail | null>(null)

  // Forms
  const [addForm, setAddForm] = useState({
    item_name: '',
    category: '',
    sku: '',
    introduced_date: new Date().toISOString().split('T')[0]
  })

  const [editForm, setEditForm] = useState({
    category: '',
    sku: '',
    discontinued_date: ''
  })

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'
  const sym = currentRestaurant?.currency_symbol || '₹'

  const fetchCatalog = async () => {
    if (!currentRestaurant) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/tenant/restaurants/${currentRestaurant.id}/menu`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      setCatalog(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load menu catalog.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCatalog()
  }, [currentRestaurant?.id])

  // Handle Add Item
  const handleOpenAdd = () => {
    setAddForm({
      item_name: '',
      category: '',
      sku: '',
      introduced_date: new Date().toISOString().split('T')[0]
    })
    setAddModalOpen(true)
  }

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentRestaurant) return
    setError(null)
    try {
      await api.post(
        `/tenant/restaurants/${currentRestaurant.id}/menu`,
        {
          item_name: addForm.item_name.trim(),
          category: addForm.category.trim(),
          sku: addForm.sku.trim() || undefined,
          introduced_date: addForm.introduced_date || undefined
        },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setAddModalOpen(false)
      setSuccessMsg(`"${addForm.item_name}" registered in menu intelligence.`)
      await fetchCatalog()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to create menu item.')
    }
  }

  // Handle Edit Item
  const handleOpenEdit = (item: MenuItemDetail) => {
    setSelectedItem(item)
    setEditForm({
      category: item.category,
      sku: item.sku || '',
      discontinued_date: item.discontinued_date || ''
    })
    setEditModalOpen(true)
  }

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentRestaurant || !selectedItem) return
    setError(null)
    try {
      await api.put(
        `/tenant/restaurants/${currentRestaurant.id}/menu/${encodeURIComponent(selectedItem.item_name)}`,
        {
          category: editForm.category.trim() || undefined,
          sku: editForm.sku.trim() || undefined,
          discontinued_date: editForm.discontinued_date || null
        },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setEditModalOpen(false)
      setSuccessMsg(`Updated metadata for "${selectedItem.item_name}".`)
      await fetchCatalog()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update menu item.')
    }
  }

  // Filter items
  const filteredItems = useMemo(() => {
    if (!catalog?.items) return []
    return catalog.items.filter(item => {
      const matchSearch =
        search === '' ||
        item.item_name.toLowerCase().includes(search.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()))

      const matchCategory =
        selectedCategory === 'all' || item.category.toLowerCase() === selectedCategory.toLowerCase()

      const matchVelocity =
        selectedVelocity === 'all' || item.demand_velocity === selectedVelocity

      return matchSearch && matchCategory && matchVelocity
    })
  }, [catalog?.items, search, selectedCategory, selectedVelocity])

  // Aggregate stats
  const totalItemsCount = catalog?.total_items || 0
  const highVelocityCount = catalog?.items.filter(i => i.demand_velocity === 'high').length || 0
  const steadyVelocityCount = catalog?.items.filter(i => i.demand_velocity === 'steady').length || 0
  const slowVelocityCount = catalog?.items.filter(i => i.demand_velocity === 'slow').length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-2xl font-black font-heading text-[var(--color-text)] flex items-center gap-3">
            <UtensilsCrossed className="w-7 h-7 text-emerald-500" />
            Menu Intelligence & Catalog
          </h1>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            Track menu dish lifecycles, historical volume velocity, and real-time forecasted demand units.
          </p>
        </div>

        {isOwnerOrAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[13px] font-semibold transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Dish</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-grow">{error}</div>
          <button onClick={() => setError(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Role notice for Analyst */}
      {!isOwnerOrAdmin && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[12px] flex items-center gap-2.5">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span>Read-only access: Menu SKU registration and lifecycle modifications require Admin or Owner privileges.</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider">Catalog Size</span>
            <UtensilsCrossed className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-heading text-[var(--color-text)]">
            {totalItemsCount}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Across {catalog?.categories.length || 0} active categories
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider">High Velocity</span>
            <Flame className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-heading text-emerald-400">
            {highVelocityCount}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Kitchen anchor dishes (&gt; 50 units/wk)
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider">Steady Sellers</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black font-heading text-blue-400">
            {steadyVelocityCount}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Consistent baseline contributors
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider">Slow-Moving</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-heading text-amber-400">
            {slowVelocityCount}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Candidates for recipe or promotion review
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-grow max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              type="text"
              placeholder="Search dishes or SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Velocity Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Velocity:
            </span>
            <div className="flex items-center bg-[var(--color-surface-alt)] p-1 rounded-lg border border-[var(--color-border-subtle)]">
              {(['all', 'high', 'steady', 'slow'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setSelectedVelocity(v)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md capitalize transition-all cursor-pointer ${
                    selectedVelocity === v
                      ? 'bg-[var(--color-surface)] text-emerald-400 shadow-xs border border-[var(--color-border)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category Pills */}
        {catalog?.categories && catalog.categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
              }`}
            >
              All Categories ({catalog.items.length})
            </button>
            {catalog.categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Catalog Table */}
      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-emerald-500" />
            <h2 className="text-[14px] font-bold text-[var(--color-text)]">
              Menu Items ({filteredItems.length})
            </h2>
          </div>
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            Showing demand velocity computed from genuine sales records
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[var(--color-text-tertiary)] flex flex-col items-center gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <span className="text-[13px]">Loading menu intelligence...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-text-tertiary)]">
            <Package className="w-9 h-9 mx-auto mb-2 opacity-40" />
            <p className="text-[14px] font-bold text-[var(--color-text)]">No Menu Items Found</p>
            <p className="text-[12px] text-[var(--color-text-secondary)] mt-1">
              {search || selectedCategory !== 'all' || selectedVelocity !== 'all'
                ? 'Try adjusting your search criteria or category filter.'
                : 'Upload POS sales data to populate menu intelligence.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Dish & SKU</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Lifecycle</th>
                  <th className="py-3 px-4 text-right">Historical Units</th>
                  <th className="py-3 px-4 text-right">Avg Price</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                  <th className="py-3 px-4 text-center">Velocity</th>
                  <th className="py-3 px-4 text-right">Forecast Demand</th>
                  {isOwnerOrAdmin && <th className="py-3 px-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                {filteredItems.map(item => {
                  return (
                    <tr key={item.id} className="hover:bg-[var(--color-surface-alt)]/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[var(--color-text)]">
                        <div>{item.item_name}</div>
                        {item.sku ? (
                          <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                            SKU: {item.sku}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--color-text-tertiary)] italic">
                            No SKU
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--color-surface-alt)] text-[var(--color-text)] font-medium text-[11px] border border-[var(--color-border)]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        {item.discontinued_date ? (
                          <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            Discontinued {item.discontinued_date}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-[var(--color-text)]">
                        {item.total_historical_units.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {sym}{item.average_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--color-text)]">
                        {sym}{item.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.demand_velocity === 'high'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : item.demand_velocity === 'steady'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {item.demand_velocity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400">
                        {item.latest_forecast_demand > 0 ? (
                          <span>~{item.latest_forecast_demand} units/day</span>
                        ) : (
                          <span className="text-[var(--color-text-tertiary)] font-normal text-[11px]">—</span>
                        )}
                      </td>
                      {isOwnerOrAdmin && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
                            title="Edit menu metadata"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ADD MENU ITEM MODAL */}
      {/* ========================================================================= */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-[var(--color-text)] mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-500" />
              Register Menu Dish
            </h3>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-4">
              Add a new dish to your catalog to track preparation requirements and forecast projections.
            </p>

            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                  Dish / Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Butter Chicken"
                  value={addForm.item_name}
                  onChange={e => setAddForm({ ...addForm, item_name: e.target.value })}
                  className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mains"
                    value={addForm.category}
                    onChange={e => setAddForm({ ...addForm, category: e.target.value })}
                    className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BUT-01"
                    value={addForm.sku}
                    onChange={e => setAddForm({ ...addForm, sku: e.target.value })}
                    className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                  Introduced Date
                </label>
                <input
                  type="date"
                  value={addForm.introduced_date}
                  onChange={e => setAddForm({ ...addForm, introduced_date: e.target.value })}
                  className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[12px] font-semibold transition-colors"
                >
                  Save Dish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT MENU METADATA MODAL */}
      {/* ========================================================================= */}
      {editModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-[var(--color-text)] mb-1 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-emerald-500" />
              Edit {selectedItem.item_name}
            </h3>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-4">
              Update category classification, SKU tracking code, or retire dish from service.
            </p>

            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                  Category
                </label>
                <input
                  type="text"
                  required
                  value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                  SKU Code
                </label>
                <input
                  type="text"
                  value={editForm.sku}
                  onChange={e => setEditForm({ ...editForm, sku: e.target.value })}
                  placeholder="e.g. SKU-123"
                  className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                  Discontinued Date
                </label>
                <input
                  type="date"
                  value={editForm.discontinued_date}
                  onChange={e => setEditForm({ ...editForm, discontinued_date: e.target.value })}
                  className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                />
                <span className="text-[10px] text-[var(--color-text-tertiary)] mt-1 block">
                  Leave blank if the dish is currently active on your menu.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[12px] font-semibold transition-colors"
                >
                  Update Metadata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
