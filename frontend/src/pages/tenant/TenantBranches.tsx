import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import {
  Building2,
  MapPin,
  Calendar,
  ShoppingBag,
  IndianRupee,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Shield
} from 'lucide-react'

interface BranchDetail {
  id: string
  restaurant_id: string
  branch_code: string
  branch_name: string
  city: string
  state?: string | null
  is_primary: boolean
  is_active: boolean
  operating_days: string
  created_at?: string
  total_orders: number
  total_revenue: number
  active_closures_count: number
}

interface BranchClosure {
  id: string
  branch_id: string
  closure_date: string
  reason?: string | null
  created_at: string
}

const ALL_DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

export function TenantBranches() {
  const { currentRestaurant, session, userRole, refreshTenants } = useAuth()
  const [branches, setBranches] = useState<BranchDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [closuresModalOpen, setClosuresModalOpen] = useState(false)

  // Selected branch for edit/delete/closures
  const [selectedBranch, setSelectedBranch] = useState<BranchDetail | null>(null)

  // Add Branch Form State
  const [addForm, setAddForm] = useState({
    branch_code: '',
    branch_name: '',
    city: '',
    state: '',
    is_primary: false,
    operating_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  })

  // Edit Branch Form State
  const [editForm, setEditForm] = useState({
    branch_name: '',
    city: '',
    state: '',
    is_active: true,
    is_primary: false,
    operating_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  })

  // Closures State
  const [closures, setClosures] = useState<BranchClosure[]>([])
  const [closuresLoading, setClosuresLoading] = useState(false)
  const [newClosureDate, setNewClosureDate] = useState('')
  const [newClosureReason, setNewClosureReason] = useState('')

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'
  const isOwner = userRole === 'owner'

  const fetchBranches = async () => {
    if (!currentRestaurant) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/tenant/restaurants/${currentRestaurant.id}/branches/metrics`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      setBranches(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load branch metrics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBranches()
  }, [currentRestaurant?.id])

  // =========================================================================
  // Add Branch
  // =========================================================================
  const handleOpenAdd = () => {
    setAddForm({
      branch_code: '',
      branch_name: '',
      city: '',
      state: '',
      is_primary: branches.length === 0,
      operating_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    })
    setAddModalOpen(true)
  }

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentRestaurant) return
    setError(null)
    try {
      await api.post(
        `/tenant/restaurants/${currentRestaurant.id}/branches`,
        {
          branch_code: addForm.branch_code.trim().toUpperCase(),
          branch_name: addForm.branch_name.trim(),
          city: addForm.city.trim(),
          state: addForm.state.trim() || undefined,
          is_primary: addForm.is_primary,
          operating_days: addForm.operating_days.join(',')
        },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setAddModalOpen(false)
      setSuccessMsg(`Outlet "${addForm.branch_name}" added successfully.`)
      await fetchBranches()
      await refreshTenants()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to create branch.')
    }
  }

  // =========================================================================
  // Edit Branch
  // =========================================================================
  const handleOpenEdit = (branch: BranchDetail) => {
    setSelectedBranch(branch)
    const days = branch.operating_days ? branch.operating_days.split(',').map(s => s.trim().toLowerCase()) : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    setEditForm({
      branch_name: branch.branch_name,
      city: branch.city,
      state: branch.state || '',
      is_active: branch.is_active,
      is_primary: branch.is_primary,
      operating_days: days
    })
    setEditModalOpen(true)
  }

  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentRestaurant || !selectedBranch) return
    setError(null)
    try {
      await api.put(
        `/tenant/restaurants/${currentRestaurant.id}/branches/${selectedBranch.id}`,
        {
          branch_name: editForm.branch_name.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim() || undefined,
          is_active: editForm.is_active,
          is_primary: editForm.is_primary,
          operating_days: editForm.operating_days.join(',')
        },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setEditModalOpen(false)
      setSuccessMsg(`Branch "${editForm.branch_name}" updated successfully.`)
      await fetchBranches()
      await refreshTenants()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update branch.')
    }
  }

  // =========================================================================
  // Delete Branch
  // =========================================================================
  const handleOpenDelete = (branch: BranchDetail) => {
    setSelectedBranch(branch)
    setDeleteModalOpen(true)
  }

  const handleDeleteBranch = async () => {
    if (!currentRestaurant || !selectedBranch) return
    setError(null)
    try {
      await api.delete(
        `/tenant/restaurants/${currentRestaurant.id}/branches/${selectedBranch.id}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setDeleteModalOpen(false)
      setSuccessMsg(`Branch "${selectedBranch.branch_name}" deleted.`)
      await fetchBranches()
      await refreshTenants()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to delete branch.')
    }
  }

  // =========================================================================
  // Closures Management
  // =========================================================================
  const handleOpenClosures = async (branch: BranchDetail) => {
    setSelectedBranch(branch)
    setClosuresModalOpen(true)
    await fetchClosures(branch.id)
  }

  const fetchClosures = async (branchId: string) => {
    if (!currentRestaurant) return
    setClosuresLoading(true)
    try {
      const res = await api.get(
        `/tenant/restaurants/${currentRestaurant.id}/branches/${branchId}/closures`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setClosures(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setClosuresLoading(false)
    }
  }

  const handleAddClosure = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentRestaurant || !selectedBranch || !newClosureDate) return
    try {
      await api.post(
        `/tenant/restaurants/${currentRestaurant.id}/branches/${selectedBranch.id}/closures`,
        {
          closure_date: newClosureDate,
          reason: newClosureReason.trim() || undefined
        },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setNewClosureDate('')
      setNewClosureReason('')
      await fetchClosures(selectedBranch.id)
      await fetchBranches()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to register closure.')
    }
  }

  const handleDeleteClosure = async (closureId: string) => {
    if (!currentRestaurant || !selectedBranch) return
    try {
      await api.delete(
        `/tenant/restaurants/${currentRestaurant.id}/branches/${selectedBranch.id}/closures/${closureId}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      await fetchClosures(selectedBranch.id)
      await fetchBranches()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to remove closure.')
    }
  }

  // Helper calculations
  const totalOutlets = branches.length
  const activeOutlets = branches.filter(b => b.is_active).length
  const aggregateOrders = branches.reduce((acc, b) => acc + (b.total_orders || 0), 0)
  const aggregateRevenue = branches.reduce((acc, b) => acc + (b.total_revenue || 0), 0)
  const sym = currentRestaurant?.currency_symbol || '₹'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-2xl font-black font-heading text-[var(--color-text)] flex items-center gap-3">
            <Building2 className="w-7 h-7 text-emerald-500" />
            Outlets & Branches
          </h1>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            Manage your restaurant locations, operating schedules, scheduled closures, and channel metrics.
          </p>
        </div>

        {isOwnerOrAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[13px] font-semibold transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Outlet</span>
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

      {/* Analyst Role Notice */}
      {!isOwnerOrAdmin && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[12px] flex items-center gap-2.5">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span>Read-only access: Branch configuration and schedule edits require Owner or Admin permissions.</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider">Total Locations</span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-heading text-[var(--color-text)]">{totalOutlets}</div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            {activeOutlets} operational · {totalOutlets - activeOutlets} inactive
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider">Active Outlets</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-heading text-emerald-400">{activeOutlets}</div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Serving live kitchen operations
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider">Aggregate Orders</span>
            <ShoppingBag className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black font-heading text-[var(--color-text)]">
            {aggregateOrders.toLocaleString()}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            POS historical transactions
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-text-tertiary)] mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider">Network Revenue</span>
            <IndianRupee className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-heading text-[var(--color-text)]">
            {sym}{aggregateRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-1 block">
            Gross multi-branch sales
          </span>
        </div>
      </div>

      {/* Branch List */}
      <div className="space-y-4">
        <h2 className="text-[15px] font-bold text-[var(--color-text)] flex items-center gap-2">
          <span>Registered Outlets</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] font-medium">
            {branches.length}
          </span>
        </h2>

        {loading ? (
          <div className="py-16 text-center text-[var(--color-text-tertiary)] flex flex-col items-center gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <span className="text-[13px]">Loading restaurant locations...</span>
          </div>
        ) : branches.length === 0 ? (
          <div className="p-8 rounded-xl bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] text-center">
            <Building2 className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3" />
            <h3 className="text-base font-bold text-[var(--color-text)]">No Outlets Registered</h3>
            <p className="text-[13px] text-[var(--color-text-secondary)] max-w-md mx-auto mt-1 mb-4">
              Get started by registering your primary kitchen or branch outlet.
            </p>
            {isOwnerOrAdmin && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[13px] font-semibold transition-colors"
              >
                Register First Outlet
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branches.map((b) => {
              const daysList = b.operating_days ? b.operating_days.split(',').map(s => s.trim().toLowerCase()) : []
              const canDelete = isOwner && !b.is_primary && branches.length > 1

              return (
                <div
                  key={b.id}
                  className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 shadow-xs flex flex-col justify-between hover:border-[var(--color-border-hover)] transition-all"
                >
                  <div>
                    {/* Top Row: Name, Code & Badges */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[16px] text-[var(--color-text)]">
                            {b.branch_name}
                          </h3>
                          {b.is_primary && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Primary Outlet
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[12px] text-[var(--color-text-secondary)]">
                          <span className="font-mono bg-[var(--color-surface-alt)] px-1.5 py-0.5 rounded text-[11px] font-semibold text-[var(--color-text-tertiary)]">
                            {b.branch_code}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                            {b.city}{b.state ? `, ${b.state}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Active Status Badge */}
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        b.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${b.is_active ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Operating Days */}
                    <div className="mb-4">
                      <div className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">
                        Operating Days
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ALL_DAYS.map(day => {
                          const isOpen = daysList.includes(day.key)
                          return (
                            <span
                              key={day.key}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                isOpen
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : 'bg-[var(--color-surface-alt)] text-[var(--color-text-tertiary)] border-transparent opacity-40'
                              }`}
                            >
                              {day.label}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    {/* Operational Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)] mb-4 text-center">
                      <div>
                        <div className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase">Orders</div>
                        <div className="text-[14px] font-bold text-[var(--color-text)] mt-0.5">
                          {b.total_orders.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase">Revenue</div>
                        <div className="text-[14px] font-bold text-[var(--color-text)] mt-0.5">
                          {sym}{b.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase">Closures</div>
                        <div className="text-[14px] font-bold text-[var(--color-text)] mt-0.5">
                          {b.active_closures_count} scheduled
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenClosures(b)}
                      className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Closures ({b.active_closures_count})</span>
                    </button>

                    {isOwnerOrAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(b)}
                          className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
                          title="Edit branch details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {isOwner && (
                          <button
                            onClick={() => handleOpenDelete(b)}
                            disabled={!canDelete}
                            className={`p-1.5 rounded-lg transition-colors ${
                              canDelete
                                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer'
                                : 'text-[var(--color-text-tertiary)] opacity-30 cursor-not-allowed'
                            }`}
                            title={
                              b.is_primary
                                ? 'Primary branch cannot be deleted'
                                : branches.length <= 1
                                ? 'Cannot delete the only branch'
                                : 'Delete branch'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ADD BRANCH MODAL */}
      {/* ========================================================================= */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-[var(--color-text)] mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-500" />
              Register New Outlet
            </h3>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-4">
              Add a branch outlet to track POS ingestion, kitchen production schedules, and localized demand forecasts.
            </p>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    Branch Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BLR-02"
                    value={addForm.branch_code}
                    onChange={e => setAddForm({ ...addForm, branch_code: e.target.value })}
                    className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Koramangala Kitchen"
                    value={addForm.branch_name}
                    onChange={e => setAddForm({ ...addForm, branch_name: e.target.value })}
                    className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bengaluru"
                    value={addForm.city}
                    onChange={e => setAddForm({ ...addForm, city: e.target.value })}
                    className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    State / Region
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Karnataka"
                    value={addForm.state}
                    onChange={e => setAddForm({ ...addForm, state: e.target.value })}
                    className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                  Operating Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DAYS.map(day => {
                    const selected = addForm.operating_days.includes(day.key)
                    return (
                      <button
                        type="button"
                        key={day.key}
                        onClick={() => {
                          const next = selected
                            ? addForm.operating_days.filter(d => d !== day.key)
                            : [...addForm.operating_days, day.key]
                          setAddForm({ ...addForm, operating_days: next })
                        }}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          selected
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-[var(--color-surface-alt)] text-[var(--color-text-tertiary)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="add-primary"
                  checked={addForm.is_primary}
                  onChange={e => setAddForm({ ...addForm, is_primary: e.target.checked })}
                  className="rounded border-[var(--color-border)] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="add-primary" className="text-[12px] text-[var(--color-text)] cursor-pointer">
                  Set as primary branch
                </label>
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
                  Create Outlet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT BRANCH MODAL */}
      {/* ========================================================================= */}
      {editModalOpen && selectedBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-[var(--color-text)] mb-1 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-emerald-500" />
              Edit Outlet ({selectedBranch.branch_code})
            </h3>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-4">
              Update branch operational metadata and active schedule.
            </p>

            <form onSubmit={handleUpdateBranch} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                  Branch Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.branch_name}
                  onChange={e => setEditForm({ ...editForm, branch_name: e.target.value })}
                  className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.city}
                    onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    State / Region
                  </label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                    className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                  Operating Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DAYS.map(day => {
                    const selected = editForm.operating_days.includes(day.key)
                    return (
                      <button
                        type="button"
                        key={day.key}
                        onClick={() => {
                          const next = selected
                            ? editForm.operating_days.filter(d => d !== day.key)
                            : [...editForm.operating_days, day.key]
                          setEditForm({ ...editForm, operating_days: next })
                        }}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          selected
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-[var(--color-surface-alt)] text-[var(--color-text-tertiary)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-active"
                    checked={editForm.is_active}
                    onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="rounded border-[var(--color-border)] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="edit-active" className="text-[12px] text-[var(--color-text)] cursor-pointer">
                    Branch is actively operating
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-primary"
                    checked={editForm.is_primary}
                    onChange={e => setEditForm({ ...editForm, is_primary: e.target.checked })}
                    className="rounded border-[var(--color-border)] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="edit-primary" className="text-[12px] text-[var(--color-text)] cursor-pointer">
                    Designate as primary restaurant outlet
                  </label>
                </div>
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
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE BRANCH CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteModalOpen && selectedBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Delete Branch Outlet?
            </h3>
            <p className="text-[13px] text-[var(--color-text-secondary)] mb-4">
              Are you sure you want to delete <strong className="text-[var(--color-text)]">{selectedBranch.branch_name}</strong> ({selectedBranch.branch_code})?
            </p>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] mb-5">
              <strong>Data Isolation Safeguard:</strong> Historical POS records associated with this branch code will remain safely archived in your normalized database, but this outlet will no longer accept new uploads or generate new forecasts.
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBranch}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CLOSURES MODAL */}
      {/* ========================================================================= */}
      {closuresModalOpen && selectedBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setClosuresModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-[var(--color-text)] mb-1 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-500" />
              Scheduled Closures · {selectedBranch.branch_name}
            </h3>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-4">
              Registered closures are used by the AI engine to calibrate demand forecasts and prevent false stock preparations.
            </p>

            {/* Add Closure Form */}
            {isOwnerOrAdmin && (
              <form onSubmit={handleAddClosure} className="p-3.5 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)] mb-5">
                <div className="text-[11px] font-bold text-[var(--color-text)] uppercase tracking-wider mb-2">
                  Register Date Closure
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <input
                    type="date"
                    required
                    value={newClosureDate}
                    onChange={e => setNewClosureDate(e.target.value)}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-[12px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Reason (e.g. Renovation)"
                    value={newClosureReason}
                    onChange={e => setNewClosureReason(e.target.value)}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-[12px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newClosureDate}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
                >
                  Schedule Closure
                </button>
              </form>
            )}

            {/* Closures List */}
            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
              {closuresLoading ? (
                <div className="py-6 text-center text-[12px] text-[var(--color-text-tertiary)]">
                  Loading closures...
                </div>
              ) : closures.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-[var(--color-text-tertiary)]">
                  No upcoming closures registered for this outlet.
                </div>
              ) : (
                closures.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)] text-[12px]"
                  >
                    <div>
                      <span className="font-bold text-[var(--color-text)]">{c.closure_date}</span>
                      {c.reason && (
                        <span className="text-[var(--color-text-secondary)] ml-2">
                          · {c.reason}
                        </span>
                      )}
                    </div>
                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => handleDeleteClosure(c.id)}
                        className="p-1 text-red-400 hover:text-red-300 transition-colors"
                        title="Remove closure"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-[var(--color-border-subtle)]">
              <button
                onClick={() => setClosuresModalOpen(false)}
                className="px-4 py-1.5 bg-[var(--color-surface-alt)] text-[var(--color-text)] rounded-lg text-[12px] font-semibold hover:bg-[var(--color-border)]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
