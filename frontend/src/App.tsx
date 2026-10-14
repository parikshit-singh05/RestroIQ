import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { Shell } from './components/layout/Shell'

// Route-level code-splitting for performance and reduced initial bundle size
const Overview = lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })))
const Forecasts = lazy(() => import('./pages/Forecasts').then(m => ({ default: m.Forecasts })))
const Inventory = lazy(() => import('./pages/Inventory').then(m => ({ default: m.Inventory })))
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })))
const Centers = lazy(() => import('./pages/Centers').then(m => ({ default: m.Centers })))
const CenterDetail = lazy(() => import('./pages/CenterDetail').then(m => ({ default: m.CenterDetail })))
const Meals = lazy(() => import('./pages/Meals').then(m => ({ default: m.Meals })))
const MealDetail = lazy(() => import('./pages/MealDetail').then(m => ({ default: m.MealDetail })))

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
      '/overview': 'Overview',
      '/forecasts': 'Forecasts',
      '/inventory': 'Inventory',
      '/analytics': 'Analytics',
      '/centers': 'Centers',
      '/meals': 'Meals'
    }

    let pageTitle = 'RestroIQ'
    if (location.pathname.startsWith('/centers/')) {
      pageTitle = 'Center Detail'
    } else if (location.pathname.startsWith('/meals/')) {
      pageTitle = 'Meal Detail'
    } else {
      pageTitle = routeTitles[location.pathname] || 'Demand Intelligence'
    }

    document.title = `RestroIQ | ${pageTitle}`
  }, [location])

  return (
    <Routes>
      <Route path="/" element={<Shell />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={
          <Suspense fallback={<PageFallback />}>
            <Overview />
          </Suspense>
        } />
        <Route path="forecasts" element={
          <Suspense fallback={<PageFallback />}>
            <Forecasts />
          </Suspense>
        } />
        <Route path="inventory" element={
          <Suspense fallback={<PageFallback />}>
            <Inventory />
          </Suspense>
        } />
        <Route path="analytics" element={
          <Suspense fallback={<PageFallback />}>
            <Analytics />
          </Suspense>
        } />
        <Route path="centers" element={
          <Suspense fallback={<PageFallback />}>
            <Centers />
          </Suspense>
        } />
        <Route path="centers/:id" element={
          <Suspense fallback={<PageFallback />}>
            <CenterDetail />
          </Suspense>
        } />
        <Route path="meals" element={
          <Suspense fallback={<PageFallback />}>
            <Meals />
          </Suspense>
        } />
        <Route path="meals/:id" element={
          <Suspense fallback={<PageFallback />}>
            <MealDetail />
          </Suspense>
        } />
      </Route>
    </Routes>
  )
}

export default App
