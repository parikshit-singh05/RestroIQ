import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ArrowLeft, Lock, Mail, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'

export function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setSubmitting(true)

    try {
      const { error: authError, data } = await signUp(email, password, fullName)
      if (authError) {
        setError(authError.message)
      } else if (data?.user && !data?.session) {
        // Confirmation required
        setNotice('Registration successful! Please check your email to confirm your account before logging in.')
      } else {
        // Instant login session created
        navigate('/app/onboarding', { replace: true })
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[var(--color-text)]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link 
          to="/overview" 
          className="inline-flex items-center text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Demo Workspace
        </Link>
        
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)] flex items-center justify-center text-white shadow-sm font-heading font-black text-xl">
            R
          </div>
          <div>
            <span className="font-heading font-black text-2xl tracking-tight text-[var(--color-text)]">RestroIQ</span>
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-accent-subtle)] text-[var(--color-accent)] tracking-wider uppercase">SaaS</span>
          </div>
        </div>
        <h2 className="mt-2 text-xl font-heading font-bold text-[var(--color-text)]">Create Restaurant Workspace</h2>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Join RestroIQ to unlock automated daily forecasts and kitchen preparation intelligence.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[var(--color-surface)] py-8 px-6 shadow-sm border border-[var(--color-border)] rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                Your Full Name
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
                  <User className="h-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Chef / Manager Name"
                  className="block w-full pl-9 pr-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                Work Email Address
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
                  <Mail className="h-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@restaurant.com"
                  className="block w-full pl-9 pr-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                Password (min 8 characters)
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
                  <Lock className="h-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                Confirm Password
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
                  <Lock className="h-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-[var(--color-accent)] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-accent)] transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-secondary)]">Already registered?</span>
              <Link
                to="/auth/login"
                className="font-bold text-[var(--color-accent)] hover:underline flex items-center"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

