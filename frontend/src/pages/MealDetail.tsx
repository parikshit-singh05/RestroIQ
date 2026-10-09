import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMeals, getDetailedForecasts, getMealsAnalysis } from '../lib/api'
import { DetailChart } from '../components/shared/DetailChart'
import { MealForecastExplorer } from '../components/meals/MealForecastExplorer'
import { ArrowLeft, UtensilsCrossed, Tag, Info } from 'lucide-react'

export function MealDetail() {
  const { id } = useParams()
  
  const mealsQuery = useQuery({ queryKey: ['meals'], queryFn: getMeals, staleTime: 5 * 60 * 1000 })
  const analysisQuery = useQuery({ queryKey: ['meals_analysis'], queryFn: () => getMealsAnalysis(), staleTime: 5 * 60 * 1000 })
  const forecastQuery = useQuery({ 
    queryKey: ['forecast_meal', id], 
    queryFn: () => getDetailedForecasts(undefined, 50000), 
    staleTime: 5 * 60 * 1000 
  })

  if (mealsQuery.isLoading || forecastQuery.isLoading || analysisQuery.isLoading) {
    return <div className="w-full h-full flex items-center justify-center text-[13px] font-medium text-[var(--color-text-tertiary)] p-12">Loading meal details...</div>
  }

  const meal = mealsQuery.data?.find((m: any) => String(m.meal_id) === id)
  const mealForecasts = forecastQuery.data?.filter(f => String(f.meal_id) === id) || []
  const mealHistory = analysisQuery.data?.find((m: any) => String(m.meal_id) === id)?.trend || []

  if (!meal) {
    return <div className="p-8 text-center text-[13px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">Meal not found.</div>
  }

  return (
    <div className="w-full pb-16 animate-in fade-in duration-500">
      <Link to="/meals" className="inline-flex items-center text-[12px] font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors mb-6">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Catalog
      </Link>
      
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 lg:p-8 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-5">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center shadow-md">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-[28px] lg:text-[36px] tracking-tight text-[var(--color-text)] leading-none mb-2">Meal {meal.meal_id}</h1>
            <div className="flex items-center space-x-4">
              <span className="flex items-center text-[13px] font-bold text-[var(--color-text-secondary)]">
                <Tag className="w-4 h-4 mr-1.5 text-[var(--color-text-tertiary)]" /> {meal.category}
              </span>
              <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
              <span className="text-[13px] font-bold text-[var(--color-text-secondary)]">{meal.cuisine}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-[var(--color-surface-alt)] px-5 py-3 rounded-xl border border-[var(--color-border)] text-center min-w-[120px]">
            <div className="text-[20px] font-heading font-bold text-[var(--color-text)] tabular-nums leading-none mb-1">{mealForecasts.length.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">Forecast Records</div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-surface-alt)] border border-[var(--color-border-subtle)] p-4 rounded-xl flex items-start space-x-3 mb-8">
        <Info className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
        <p className="text-[13px] font-medium text-[var(--color-text-secondary)] leading-relaxed">
          Base price varies by center and week based on local economics. The forecast explorer below shows precise price points for each prediction record.
        </p>
      </div>

      <DetailChart history={mealHistory} forecast={mealForecasts} title="10-Week Demand Trajectory" subtitle="Historical actuals vs predicted orders for Meal ${meal.meal_id} (${meal.category})" />
      <MealForecastExplorer forecasts={mealForecasts} />
    </div>
  )
}

