import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import {
  Building2,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle
} from 'lucide-react'

export function Onboarding() {
  const { session, refreshTenants } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdRestaurantId, setCreatedRestaurantId] = useState<string | null>(null)

  // Step 1: Restaurant Info
  const [restaurantName, setRestaurantName] = useState('The Spice Garden Cafe & Bistro')
  const [currency, setCurrency] = useState('INR')
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [operationalModel, setOperationalModel] = useState('dine_in_and_delivery')

  // Step 2: Branch Info
  const [branchName, setBranchName] = useState('Indiranagar Outlet')
  const [branchCode, setBranchCode] = useState('IND01')
  const [city, setCity] = useState('Bengaluru')
  const [state, setState] = useState('Karnataka')

  // Step 3: Preferences
  const [prepBuffer, setPrepBuffer] = useState<number>(10)
  const [forecastFrequency, setForecastFrequency] = useState<'daily' | 'weekly'>('daily')

  const handleNext = () => {
    setError(null)
    if (step === 1) {
      if (!restaurantName.trim()) {
        setError('Please enter a restaurant name.')
        return
      }
      setStep(2)
    } else if (step === 2) {
      if (!branchName.trim() || !branchCode.trim() || !city.trim()) {
        setError('Please complete all branch outlet details.')
        return
      }
      setStep(3)
    }
  }

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // 1. Create or reuse restaurant (idempotent across retry)
      let restaurantId = createdRestaurantId
      if (!restaurantId) {
        const restRes = await api.post('/tenant/restaurants', {
          name: restaurantName,
          currency,
          timezone,
          operational_model: operationalModel,
          branch_name: branchName,
          branch_code: branchCode.toUpperCase(),
          city,
          state,
          default_prep_buffer: prepBuffer,
          default_forecasting_frequency: forecastFrequency
        }, {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        })

        restaurantId = restRes.data.id
        setCreatedRestaurantId(restaurantId)
      }

      // 2. Ensure primary outlet branch details are synced
      try {
        await api.post(`/tenant/restaurants/${restaurantId}/branches`, {
          branch_code: branchCode.toUpperCase(),
          branch_name: branchName,
          city,
          state,
          is_primary: true
        }, {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        })
      } catch (branchErr) {
        console.warn('Primary branch sync note:', branchErr)
      }

      // 3. Ensure operational preferences are synced
      try {
        await api.put(`/tenant/restaurants/${restaurantId}/settings`, {
          default_prep_buffer: prepBuffer,
          default_forecasting_frequency: forecastFrequency,
          auto_forecast_on_upload: true
        }, {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        })
      } catch (settingsErr) {
        console.warn('Operational preferences sync note:', settingsErr)
      }

      // Refresh tenants in context and route to upload wizard
      await refreshTenants()
      navigate('/app/upload', {
        state: { welcome: `Welcome to ${restaurantName}! Upload your sales data or load sample data to begin.` }
      })
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to complete workspace setup.'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="flex justify-center items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold text-lg">
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">RestroIQ</span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Workspace Setup
          </span>
        </div>

        {/* Progress Stepper */}
        <div className="mb-8 flex items-center justify-between relative max-w-md mx-auto">
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-[var(--color-border-subtle)] -z-0" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${step >= 1 ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]'}`}>
              {step > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-1.5">Organization</span>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${step >= 2 ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]'}`}>
              {step > 2 ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-1.5">Primary Outlet</span>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${step >= 3 ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]'}`}>
              3
            </div>
            <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] mt-1.5">Preferences</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-[var(--color-bg-surface)] p-6 sm:p-8 rounded-2xl border border-[var(--color-border-subtle)] shadow-xl shadow-black/20">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-red-400 text-[13px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Configure your Restaurant</h3>
                <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
                  Enter your restaurant organization name and operating parameters.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Restaurant Brand Name
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="e.g. The Spice Garden Cafe & Bistro"
                    className="block w-full pl-10 pr-3.5 py-2.5 text-[13px] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    Operating Model
                  </label>
                  <select
                    value={operationalModel}
                    onChange={(e) => setOperationalModel(e.target.value)}
                    className="block w-full px-3.5 py-2.5 text-[13px] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value="dine_in_and_delivery">Dine-in & Delivery</option>
                    <option value="fine_dining">Fine Dining Bistro</option>
                    <option value="cloud_kitchen">Cloud Kitchen / QSR</option>
                    <option value="cafeteria">Cafeteria / Buffet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    Currency & Symbol
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="block w-full px-3.5 py-2.5 text-[13px] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    <option value="INR">Indian Rupee (INR ₹)</option>
                    <option value="USD">US Dollar (USD $)</option>
                    <option value="EUR">Euro (EUR €)</option>
                    <option value="GBP">British Pound (GBP £)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Operating Timezone
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="block w-full px-3.5 py-2.5 text-[13px] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/20"
                >
                  <span>Continue to Outlet Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Add Primary Outlet Branch</h3>
                <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
                  Configure the primary physical location for orders and inventory forecasting.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    Branch Name
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="e.g. Indiranagar Outlet"
                      className="block w-full pl-10 pr-3.5 py-2.5 text-[13px] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    Branch Code
                  </label>
                  <input
                    type="text"
                    required
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                    placeholder="e.g. IND01"
                    className="block w-full px-3.5 py-2.5 text-[13px] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] uppercase focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className="block w-full px-3.5 py-2.5 text-[13px] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                    State / Province
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="block w-full px-3.5 py-2.5 text-[13px] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/20"
                >
                  <span>Continue to Preferences</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleFinish} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Operational Preferences</h3>
                <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
                  Configure default preparation buffers and forecasting cadence.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                  Default Kitchen Preparation Safety Buffer
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { value: 0, label: '0% Buffer', desc: 'Exact Predicted' },
                    { value: 10, label: '10% Buffer', desc: 'Recommended', badge: 'Optimal' },
                    { value: 15, label: '15% Buffer', desc: 'Weekend Rush' },
                    { value: 20, label: '20% Buffer', desc: 'Zero Stockout' },
                  ].map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => setPrepBuffer(b.value)}
                      className={`p-3 rounded-xl border text-left transition-all relative ${
                        prepBuffer === b.value
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                          : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] hover:border-[var(--color-border)]'
                      }`}
                    >
                      {b.badge && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          {b.badge}
                        </span>
                      )}
                      <div className="text-[13px] font-bold text-[var(--color-text-primary)]">{b.label}</div>
                      <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{b.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Forecasting Horizon Cadence
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setForecastFrequency('daily')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      forecastFrequency === 'daily'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]'
                    }`}
                  >
                    <div className="text-[13px] font-bold text-[var(--color-text-primary)]">Daily (14-Day Horizon)</div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                      Dish-by-dish daily prep targets with day-of-week seasonality (Friday-Sunday peaks).
                    </div>
                  </div>

                  <div
                    onClick={() => setForecastFrequency('weekly')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      forecastFrequency === 'weekly'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]'
                    }`}
                  >
                    <div className="text-[13px] font-bold text-[var(--color-text-primary)]">Weekly (4 to 10 Weeks)</div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                      Aggregated weekly supply procurement and multi-week ingredient planning.
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  <span>{submitting ? 'Creating Workspace...' : 'Launch SaaS Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
