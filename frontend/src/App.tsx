import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Shell } from './components/layout/Shell'
import { Overview } from './pages/Overview'
import { Forecasts } from './pages/Forecasts'
import { Inventory } from './pages/Inventory'
import { Analytics } from './pages/Analytics'
import { Centers } from './pages/Centers'
import { CenterDetail } from './pages/CenterDetail'
import { Meals } from './pages/Meals'
import { MealDetail } from './pages/MealDetail'

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
        <Route path="overview" element={<Overview />} />
        <Route path="forecasts" element={<Forecasts />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="centers" element={<Centers />} />
        <Route path="centers/:id" element={<CenterDetail />} />
        <Route path="meals" element={<Meals />} />
        <Route path="meals/:id" element={<MealDetail />} />
      </Route>
    </Routes>
  )
}

export default App