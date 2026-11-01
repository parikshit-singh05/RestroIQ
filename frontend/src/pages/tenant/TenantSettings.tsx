import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import {
  Settings,
  Building2,
  Sliders,
  Users,
  Shield,
  CheckCircle2,
  AlertTriangle,
  X,
  Mail,
  UserPlus,
  Trash2
} from 'lucide-react'

interface RestaurantProfile {
  id: string
  name: string
  slug: string
  cuisine?: string | null
  currency: string
  currency_symbol: string
  timezone: string
  operational_model: string
  created_at: string
}

interface OperationalSettings {
  restaurant_id: string
  default_prep_buffer: number
  default_forecasting_frequency: string
  auto_forecast_on_upload: boolean
  updated_at?: string | null
}

interface TeamMember {
  id: string
  restaurant_id: string
  user_id: string
  email?: string | null
  full_name?: string | null
  role: 'owner' | 'admin' | 'analyst'
  created_at?: string | null
}

export function TenantSettings() {
  const { currentRestaurant, session, userRole, refreshTenants } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'team'>('profile')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Profile Form
  const [profile, setProfile] = useState<RestaurantProfile | null>(null)
  const [profileForm, setProfileForm] = useState({
    name: '',
    cuisine: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    operational_model: 'dine_in'
  })

  // Preferences Form
  const [settings, setSettings] = useState<OperationalSettings | null>(null)
  const [settingsForm, setSettingsForm] = useState({
    default_prep_buffer: 10,
    default_forecasting_frequency: 'daily',
    auto_forecast_on_upload: true
  })

  // Team Form & Modals
  const [members, setMembers] = useState<TeamMember[]>([])
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'analyst'>('analyst')
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null)

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin'

  // Load all initial data
  const loadSettingsData = async () => {
    if (!currentRestaurant) return
    setLoading(true)
    setError(null)
    try {
      const authHeader = { headers: { Authorization: `Bearer ${session?.access_token}` } }

      // 1. Fetch Profile
      try {
        const profRes = await api.get(`/tenant/restaurants/${currentRestaurant.id}/profile`, authHeader)
        setProfile(profRes.data)
        setProfileForm({
          name: profRes.data.name || '',
          cuisine: profRes.data.cuisine || '',
          currency: profRes.data.currency || 'INR',
          timezone: profRes.data.timezone || 'Asia/Kolkata',
          operational_model: profRes.data.operational_model || 'dine_in'
        })
      } catch {
        // Fallback to auth context currentRestaurant
        setProfile(currentRestaurant as any)
        setProfileForm({
          name: currentRestaurant.name,
          cuisine: '',
          currency: currentRestaurant.currency || 'INR',
          timezone: currentRestaurant.timezone || 'Asia/Kolkata',
          operational_model: currentRestaurant.operational_model || 'dine_in'
        })
      }

      // 2. Fetch Operational Settings
      try {
        const setRes = await api.get(`/tenant/restaurants/${currentRestaurant.id}/settings`, authHeader)
        setSettings(setRes.data)
        setSettingsForm({
          default_prep_buffer: setRes.data.default_prep_buffer ?? 10,
          default_forecasting_frequency: setRes.data.default_forecasting_frequency || 'daily',
          auto_forecast_on_upload: setRes.data.auto_forecast_on_upload ?? true
        })
      } catch {
        // defaults
      }

      // 3. Fetch Team Members
      try {
        const memRes = await api.get(`/tenant/restaurants/${currentRestaurant.id}/members`, authHeader)
        setMembers(memRes.data)
      } catch (err: any) {
        console.error('Failed to load team members:', err)
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to initialize settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettingsData()
  }, [currentRestaurant?.id])

  // =========================================================================
  // Save Profile
  // =========================================================================
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentRestaurant) return
    setSaving(true)
    setError(null)
    try {
      await api.put(
        `/tenant/restaurants/${currentRestaurant.id}/profile`,
        {
          name: profileForm.name.trim(),
          cuisine: profileForm.cuisine.trim() || undefined,
          currency: profileForm.currency,
          timezone: profileForm.timezone,
          operational_model: profileForm.operational_model
        },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setSuccessMsg('Restaurant profile saved successfully.')
      await refreshTenants()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  // =========================================================================
  // Save Preferences
  // =========================================================================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentRestaurant) return
    setSaving(true)
    setError(null)
    try {
      await api.put(
        `/tenant/restaurants/${currentRestaurant.id}/settings`,
        {
          default_prep_buffer: Number(settingsForm.default_prep_buffer),
          default_forecasting_frequency: settingsForm.default_forecasting_frequency,
          auto_forecast_on_upload: settingsForm.auto_forecast_on_upload
        },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setSuccessMsg('Operational preferences updated successfully.')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update preferences.')
    } finally {
      setSaving(false)
    }
  }

  // =========================================================================
  // Team Management: Update Role
  // =========================================================================
  const handleRoleChange = async (member: TeamMember, newRole: string) => {
    if (!currentRestaurant) return
    setError(null)
    try {
      await api.put(
        `/tenant/restaurants/${currentRestaurant.id}/members/${member.id}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setSuccessMsg(`Updated role for ${member.email || 'team member'} to ${newRole}.`)
      // Refresh members
      const memRes = await api.get(
        `/tenant/restaurants/${currentRestaurant.id}/members`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setMembers(memRes.data)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update member role.')
    }
  }

  // =========================================================================
  // Team Management: Invite Member
  // =========================================================================
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentRestaurant || !inviteEmail) return
    setError(null)
    try {
      await api.post(
        `/tenant/restaurants/${currentRestaurant.id}/members`,
        {
          email: inviteEmail.trim(),
          role: inviteRole
        },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setInviteModalOpen(false)
      setInviteEmail('')
      setSuccessMsg(`Invitation sent to ${inviteEmail}.`)
      const memRes = await api.get(
        `/tenant/restaurants/${currentRestaurant.id}/members`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setMembers(memRes.data)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to invite team member.')
    }
  }

  // =========================================================================
  // Team Management: Remove Member
  // =========================================================================
  const handleConfirmRemoveMember = async () => {
    if (!currentRestaurant || !memberToDelete) return
    setError(null)
    try {
      await api.delete(
        `/tenant/restaurants/${currentRestaurant.id}/members/${memberToDelete.id}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setMemberToDelete(null)
      setSuccessMsg(`Team member removed.`)
      const memRes = await api.get(
        `/tenant/restaurants/${currentRestaurant.id}/members`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      )
      setMembers(memRes.data)
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to remove member.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-2xl font-black font-heading text-[var(--color-text)] flex items-center gap-3">
            <Settings className="w-7 h-7 text-emerald-500" />
            Restaurant Settings & Team
          </h1>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
            Configure business identity, operational buffers, AI forecasting parameters, and team permissions.
          </p>
        </div>
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

      {!isOwnerOrAdmin && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[12px] flex items-center gap-2.5">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span>Read-only access: Operational configuration and team administration require Owner or Admin privileges.</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-[var(--color-border)] gap-2">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Restaurant Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'preferences'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Forecasting Preferences</span>
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'team'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team & RBAC ({members.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[var(--color-text-tertiary)] flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className="text-[13px]">Loading settings workspace...</span>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: RESTAURANT PROFILE */}
          {/* ========================================================================= */}
          {activeTab === 'profile' && (
            <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-xs max-w-2xl">
              <h2 className="text-base font-bold text-[var(--color-text)] mb-1">
                Organization Identity
              </h2>
              <p className="text-[12px] text-[var(--color-text-secondary)] mb-6">
                Update restaurant profile branding, localization currency, and operating timezone.
              </p>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    Restaurant Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isOwnerOrAdmin}
                    value={profileForm.name}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    Workspace Identifier (Slug)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile?.slug || ''}
                    className="w-full bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text-tertiary)] font-mono cursor-not-allowed"
                  />
                  <span className="text-[10px] text-[var(--color-text-tertiary)] mt-1 block">
                    Permanent slug generated during restaurant onboarding.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                      Currency
                    </label>
                    <select
                      disabled={!isOwnerOrAdmin}
                      value={profileForm.currency}
                      onChange={e => setProfileForm({ ...profileForm, currency: e.target.value })}
                      className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none disabled:opacity-60"
                    >
                      <option value="INR">INR — Indian Rupee (₹)</option>
                      <option value="USD">USD — US Dollar ($)</option>
                      <option value="EUR">EUR — Euro (€)</option>
                      <option value="GBP">GBP — British Pound (£)</option>
                      <option value="AED">AED — UAE Dirham (د.إ)</option>
                      <option value="SGD">SGD — Singapore Dollar ($)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                      Operating Timezone
                    </label>
                    <select
                      disabled={!isOwnerOrAdmin}
                      value={profileForm.timezone}
                      onChange={e => setProfileForm({ ...profileForm, timezone: e.target.value })}
                      className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none disabled:opacity-60"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">America/New_York (EST / EDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST / PDT)</option>
                      <option value="Europe/London">Europe/London (GMT / BST)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                      Operational Model
                    </label>
                    <select
                      disabled={!isOwnerOrAdmin}
                      value={profileForm.operational_model}
                      onChange={e => setProfileForm({ ...profileForm, operational_model: e.target.value })}
                      className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none disabled:opacity-60"
                    >
                      <option value="dine_in">Dine-in Full Service</option>
                      <option value="cloud_kitchen">Cloud Kitchen / Ghost Kitchen</option>
                      <option value="hybrid">Hybrid (Dine-in + Takeaway/Delivery)</option>
                      <option value="qsr">Quick Service Restaurant (QSR)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                      Primary Cuisine
                    </label>
                    <input
                      type="text"
                      disabled={!isOwnerOrAdmin}
                      placeholder="e.g. North Indian, Continental"
                      value={profileForm.cuisine}
                      onChange={e => setProfileForm({ ...profileForm, cuisine: e.target.value })}
                      className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none disabled:opacity-60"
                    />
                  </div>
                </div>

                {isOwnerOrAdmin && (
                  <div className="pt-4 border-t border-[var(--color-border-subtle)] flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: PREFERENCES & AI FORECASTING */}
          {/* ========================================================================= */}
          {activeTab === 'preferences' && (
            <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-xs max-w-2xl">
              <h2 className="text-base font-bold text-[var(--color-text)] mb-1">
                Forecasting Engine & Kitchen Safety Buffers
              </h2>
              <p className="text-[12px] text-[var(--color-text-secondary)] mb-6">
                Configure default demand horizon planning and preparation safety buffers across all kitchens.
              </p>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                    Default Kitchen Safety Buffer
                  </label>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mb-3">
                    Safety buffer automatically applied to predicted demand units to mitigate stockouts during peak shifts.
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 10, 15, 20].map(pct => (
                      <button
                        type="button"
                        key={pct}
                        disabled={!isOwnerOrAdmin}
                        onClick={() => setSettingsForm({ ...settingsForm, default_prep_buffer: pct })}
                        className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${
                          settingsForm.default_prep_buffer === pct
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold shadow-xs'
                            : 'bg-[var(--color-surface-alt)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                      >
                        <div className="text-lg font-black">{pct}%</div>
                        <div className="text-[10px] uppercase font-bold mt-0.5">
                          {pct === 0 ? 'Zero Buffer' : pct === 10 ? 'Standard' : pct === 15 ? 'High Demand' : 'Surge Buffer'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    Default Forecasting Cadence
                  </label>
                  <select
                    disabled={!isOwnerOrAdmin}
                    value={settingsForm.default_forecasting_frequency}
                    onChange={e => setSettingsForm({ ...settingsForm, default_forecasting_frequency: e.target.value })}
                    className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none disabled:opacity-60"
                  >
                    <option value="daily">Daily Horizon (14 Days Continuous Walk-Forward)</option>
                    <option value="weekly">Weekly Horizon (4 Weeks Kitchen Cycle)</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)] flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="auto-forecast"
                    disabled={!isOwnerOrAdmin}
                    checked={settingsForm.auto_forecast_on_upload}
                    onChange={e => setSettingsForm({ ...settingsForm, auto_forecast_on_upload: e.target.checked })}
                    className="mt-1 rounded border-[var(--color-border)] text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="auto-forecast" className="text-[13px] font-bold text-[var(--color-text)] cursor-pointer">
                      Automatic Forecast Trigger
                    </label>
                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
                      Automatically evaluate LightGBM, Prophet, and Holt-Winters models upon every verified POS file import.
                    </p>
                  </div>
                </div>

                {isOwnerOrAdmin && (
                  <div className="pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                      {settings?.updated_at ? `Last configured: ${new Date(settings.updated_at).toLocaleDateString()}` : 'Default policy active'}
                    </span>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? 'Saving...' : 'Update Preferences'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: TEAM & RBAC */}
          {/* ========================================================================= */}
          {activeTab === 'team' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">
                    Team Members & Access Roles
                  </h2>
                  <p className="text-[12px] text-[var(--color-text-secondary)]">
                    Enforce strict role-based isolation across Owner, Admin, and Analyst access levels.
                  </p>
                </div>

                {isOwnerOrAdmin && (
                  <button
                    onClick={() => setInviteModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[12px] font-semibold transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Invite Team Member</span>
                  </button>
                )}
              </div>

              {/* Members Table */}
              <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden shadow-xs">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)] text-[var(--color-text-tertiary)] uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Permissions</th>
                      <th className="py-3 px-4">Added On</th>
                      {isOwnerOrAdmin && <th className="py-3 px-4 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                    {members.map(member => {
                      const initials = (member.full_name || member.email || 'U').substring(0, 2).toUpperCase()
                      const isSoleOwner = member.role === 'owner' && members.filter(m => m.role === 'owner').length <= 1

                      return (
                        <tr key={member.id} className="hover:bg-[var(--color-surface-alt)]/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-600/20 text-emerald-400 font-bold text-[12px] flex items-center justify-center border border-emerald-500/30">
                                {initials}
                              </div>
                              <div>
                                <div className="font-bold text-[var(--color-text)]">
                                  {member.full_name || member.email?.split('@')[0]}
                                </div>
                                <div className="text-[11px] text-[var(--color-text-tertiary)]">
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {isOwnerOrAdmin ? (
                              <select
                                value={member.role}
                                onChange={e => handleRoleChange(member, e.target.value)}
                                className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-md px-2 py-1 text-[11px] font-bold text-[var(--color-text)] capitalize outline-none cursor-pointer hover:border-emerald-500"
                              >
                                <option value="owner">Owner</option>
                                <option value="admin">Admin</option>
                                <option value="analyst">Analyst</option>
                              </select>
                            ) : (
                              <span className="capitalize font-bold text-[var(--color-text)]">
                                {member.role}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-[11px]">
                            {member.role === 'owner' ? (
                              <span className="text-emerald-400 font-medium">Full organization ownership & billing</span>
                            ) : member.role === 'admin' ? (
                              <span className="text-blue-400 font-medium">Ingestion, schedules, metadata & forecast runs</span>
                            ) : (
                              <span className="text-[var(--color-text-tertiary)]">Read-only dashboards & exports</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-[11px] text-[var(--color-text-tertiary)]">
                            {member.created_at ? new Date(member.created_at).toLocaleDateString() : 'Active'}
                          </td>

                          {isOwnerOrAdmin && (
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setMemberToDelete(member)}
                                disabled={isSoleOwner}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isSoleOwner
                                    ? 'text-[var(--color-text-tertiary)] opacity-30 cursor-not-allowed'
                                    : 'text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer'
                                }`}
                                title={isSoleOwner ? 'Cannot remove the sole owner' : 'Remove team member'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* INVITE TEAM MEMBER MODAL */}
      {/* ========================================================================= */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setInviteModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-[var(--color-text)] mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-500" />
              Invite Team Member
            </h3>
            <p className="text-[12px] text-[var(--color-text-secondary)] mb-4">
              Add a restaurant manager or analyst to collaborate on forecasts and kitchen prep sheets.
            </p>

            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <input
                    type="email"
                    required
                    placeholder="manager@restaurant.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                  Access Role *
                </label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  className="w-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--color-text)] focus:border-emerald-500 outline-none"
                >
                  <option value="analyst">Analyst (Read-only dashboards & CSV exports)</option>
                  <option value="admin">Admin (POS uploads, menu edits, branch configurations)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[12px] font-semibold transition-colors"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REMOVE MEMBER CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setMemberToDelete(null)}
              className="absolute top-4 right-4 p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold font-heading text-red-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Remove Team Member?
            </h3>
            <p className="text-[13px] text-[var(--color-text-secondary)] mb-4">
              Are you sure you want to remove <strong className="text-[var(--color-text)]">{memberToDelete.email || 'this member'}</strong> from the organization?
            </p>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] mb-5">
              <strong>Sole Owner Protection:</strong> If this member is the sole registered owner, the system will reject removal to ensure organization continuity.
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveMember}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
