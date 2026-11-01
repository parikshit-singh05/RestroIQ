import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Mail, AlertCircle, CheckCircle2 } from 'lucide-react'

export function ResetPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
      } else {
        setSubmitted(true)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to request password reset.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold text-lg">
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">RestroIQ</span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SaaS 3.0</span>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-[13px] text-[var(--color-text-secondary)]">
          Enter your registered email address and we'll send you recovery instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-[var(--color-bg-surface)] py-8 px-6 shadow-xl shadow-black/20 rounded-2xl border border-[var(--color-border-subtle)] sm:px-10">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">Check your email</h3>
              <p className="text-[13px] text-[var(--color-text-secondary)] mb-6">
                We have dispatched password recovery instructions to <strong className="text-[var(--color-text-primary)]">{email}</strong>.
              </p>
              <Link
                to="/auth/login"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl text-[13px] font-semibold text-white bg-[var(--color-accent)] hover:opacity-90 transition-all shadow-md shadow-[var(--color-accent)]/20"
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleResetRequest}>
              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-red-400 text-[13px]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Work Email Address
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@restaurant.com"
                    className="block w-full pl-10 pr-3.5 py-2.5 text-[13px] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-all"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md shadow-[var(--color-accent)]/20 text-[13px] font-semibold text-white bg-[var(--color-accent)] hover:opacity-90 focus:outline-none transition-all disabled:opacity-50"
                >
                  {loading ? 'Sending Instructions...' : 'Send Recovery Instructions'}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  to="/auth/login"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
