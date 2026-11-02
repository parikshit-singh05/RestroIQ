import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ArrowLeft, Lock, Mail, AlertCircle, ArrowRight, Sparkles } from 'lucide-react'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const from = (location.state as any)?.from?.pathname || '/app/overview'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { error: authError } = await signIn(email, password)
      if (authError) {
        setError(authError.message)
      } else {
        // Successful login
        navigate(from, { replace: true })
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate. Please check your credentials.')
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
        <h2 className="mt-2 text-xl font-heading font-bold text-[var(--color-text)]">Sign in to your restaurant</h2>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Access your demand forecasts, upload POS sales logs, and plan daily preparations.
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

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-[var(--color-text)] mb-1">
                Email Address
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
                  placeholder="manager@restaurant.com"
                  className="block w-full pl-9 pr-3 py-2 bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[var(--color-text)]">
                  Password
                </label>
                <Link
                  to="/auth/reset-password"
                  className="text-[11px] font-semibold text-[var(--color-accent)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-[var(--color-accent)] hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-accent)] transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-secondary)]">Don't have an account?</span>
              <Link
                to="/auth/signup"
                className="font-bold text-[var(--color-accent)] hover:underline flex items-center"
              >
                Register Restaurant
              </Link>
            </div>
          </div>
        </div>

        {/* Demo Callout */}
        <div className="mt-6 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)] flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-[var(--color-text-secondary)]">
            <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
            <span>Looking for the Kaggle test benchmark?</span>
          </div>
          <Link to="/overview" className="font-bold text-[var(--color-accent)] hover:underline">
            Explore Demo &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}

