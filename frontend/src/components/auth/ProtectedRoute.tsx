import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, restaurants } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col items-center justify-center text-[var(--color-text-secondary)]">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin mb-4" />
        <span className="text-[13px] font-medium tracking-wide">Authenticating SaaS Session...</span>
      </div>
    )
  }

  if (!user) {
    // Redirect unauthenticated visitors to login, preserving intended route
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // If user has no registered restaurants and is not already on onboarding, prompt onboarding
  if (restaurants.length === 0 && location.pathname !== '/app/onboarding') {
    return <Navigate to="/app/onboarding" replace />
  }

  return <>{children}</>
}
