import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { Shell } from './components/layout/Shell'
import { TenantShell } from './components/layout/TenantShell'
import { ProtectedRoute } from './components/auth/ProtectedRoute'

// Demo workspace pages (lazy-loaded)
const Overview = lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })))
const Forecasts = lazy(() => import('./pages/Forecasts').then(m => ({ default: m.Forecasts })))
const Inventory = lazy(() => import('./pages/Inventory').then(m => ({ default: m.Inventory })))
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })))
const Centers = lazy(() => import('./pages/Centers').then(m => ({ default: m.Centers })))
const CenterDetail = lazy(() => import('./pages/CenterDetail').then(m => ({ default: m.CenterDetail })))
const Meals = lazy(() => import('./pages/Meals').then(m => ({ default: m.Meals })))
const MealDetail = lazy(() => import('./pages/MealDetail').then(m => ({ default: m.MealDetail })))

// Auth pages
const Login = lazy(() => import('./pages/auth/Login').then(m => ({ default: m.Login })))
const Signup = lazy(() => import('./pages/auth/Signup').then(m => ({ default: m.Signup })))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword').then(m => ({ default: m.ResetPassword })))

// Tenant SaaS pages
const Onboarding = lazy(() => import('./pages/tenant/Onboarding').then(m => ({ default: m.Onboarding })))
const UploadPOS = lazy(() => import('./pages/tenant/UploadPOS').then(m => ({ default: m.UploadPOS })))
const TenantOverview = lazy(() => import('./pages/tenant/TenantOverview').then(m => ({ default: m.TenantOverview })))

function PageFallback() {
  return (
    <div className="w-full py-20 flex flex-col items-center justify-center text-[13px] font-medium text-[var(--color-text-tertiary)] animate-pulse">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin mb-3" />
      <span>Loading module...</span>
    </div>
  )
}

function App() {
  const location = useLocation()

  useEffect(() => {
    const routeTitles: Record<string, string> = {
      '/overview': 'Kaggle Benchmark Overview',
      '/forecasts': 'Kaggle Benchmark Forecasts',
      '/inventory': 'Kaggle Benchmark Inventory',
      '/analytics': 'Kaggle Benchmark Analytics',
      '/centers': 'Fulfillment Centers',
      '/meals': 'Meal Master',
      '/auth/login': 'Sign In',
      '/auth/signup': 'Restaurant Registration',
      '/auth/reset-password': 'Password Recovery',
      '/app/overview': 'My Restaurant Operations',
      '/app/upload': 'Upload POS Sales Data',
      '/app/onboarding': 'Restaurant Workspace Onboarding'
    }

    let pageTitle = 'RestroIQ'
    if (location.pathname.startsWith('/centers/')) {
      pageTitle = 'Center Detail'
    } else if (location.pathname.startsWith('/meals/')) {
      pageTitle = 'Meal Detail'
    } else {
      pageTitle = routeTitles[location.pathname] || 'Restaurant Demand Intelligence'
    }

    document.title = `RestroIQ | ${pageTitle}`
  }, [location])

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Auth Routes */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/signup" element={<Signup />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />

        {/* Tenant Onboarding (Protected) */}
        <Route path="/app/onboarding" element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        } />

        {/* Tenant SaaS Application Shell */}
        <Route path="/app" element={
          <ProtectedRoute>
            <TenantShell />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/app/overview" replace />} />
          <Route path="overview" element={<TenantOverview />} />
          <Route path="upload" element={<UploadPOS />} />
          <Route path="forecasts" element={<TenantOverview />} />
          <Route path="inventory" element={<TenantOverview />} />
          <Route path="analytics" element={<TenantOverview />} />
        </Route>

        {/* Kaggle Demo Workspace Shell (Public / Unauthenticated default) */}
        <Route path="/" element={<Shell />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="forecasts" element={<Forecasts />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="centers" element={<Centers />} />
          <Route path="centers/:id" element={<CenterDetail />} />
          <Route path="meals" element={<Meals />} />
          <Route path="meals/:id" element={<MealDetail />} />
        </Route>

        {/* Catch-all redirect to Demo Overview */}
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
