import { Routes, Route, Navigate } from 'react-router-dom'
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
  return (
    <Routes>
      <Route path="/" element={<Shell />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="forecasts" element={<Forecasts />} />
        
        {/* Placeholders for future pages */}
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