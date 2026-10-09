import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMealsAnalysis } from '../lib/api'
import { useAppContext } from '../context/AppContext'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { MealsSummary } from '../components/meals/MealsSummary'
import { MealsDistribution } from '../components/meals/MealsDistribution'
import { MealsCategoryAnalysis } from '../components/meals/MealsCategoryAnalysis'
import { MealsDirectory } from '../components/meals/MealsDirectory'
import { MealForecastExplorer } from '../components/meals/MealForecastExplorer'

export interface MealsFilterState {
  week: number | '';
  city: string;
  center_id: number | '';
  category: string;
  cuisine: string;
  search: string;
}

export function Meals() {
  const { buffer } = useAppContext()
  const bufferPct = buffer / 100
  const [filters, setFilters] = useState<MealsFilterState>({ week: '', city: '', center_id: '', category: '', cuisine: '', search: '' })

  const queryParams = {
    ...(filters.week !== '' && { week: filters.week }),
    ...(filters.city !== '' && { city: filters.city }),
    ...(filters.center_id !== '' && { center_id: filters.center_id }),
    ...(filters.category !== '' && { category: filters.category }),
    ...(filters.cuisine !== '' && { cuisine: filters.cuisine }),
  }

  const { data: meals = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['meals_analysis', queryParams],
    queryFn: () => getMealsAnalysis(queryParams)
  })

  const filteredMeals = useMemo(() => {
    return meals.filter(m => {
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (
          !m.meal_id.toString().includes(s) && 
          !m.category.toLowerCase().includes(s) && 
          !m.cuisine.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    })
  }, [meals, filters])

  const totalFilteredDemand = useMemo(() => filteredMeals.reduce((sum, m) => sum + m.predicted_orders, 0), [filteredMeals])

  const topMeal = useMemo(() => {
    if (!filteredMeals.length) return null
    return [...filteredMeals].sort((a, b) => b.predicted_orders - a.predicted_orders)[0]
  }, [filteredMeals])

  const insight = topMeal && totalFilteredDemand > 0
    ? `Meal ${topMeal.meal_id} (${topMeal.category}) represents the largest forecast volume (${((topMeal.predicted_orders / totalFilteredDemand) * 100).toFixed(1)}% of filtered view) across the planning horizon.`
    : `Understand meal-level demand, forecast patterns, and preparation requirements across the network.`

  if (isLoading && !meals.length) {
    return (
      <div className="max-w-[1120px] mx-auto pb-16 pt-8 animate-pulse">
        <div className="h-10 bg-black/5 w-1/4 mb-4 rounded"></div>
        <div className="h-4 bg-black/5 w-2/3 mb-12 rounded"></div>
        <div className="h-24 bg-black/5 w-full mb-8 rounded"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
           <div className="lg:col-span-2 h-80 bg-black/5 rounded"></div>
           <div className="h-80 bg-black/5 rounded"></div>
        </div>
        <div className="h-64 bg-black/5 w-full rounded"></div>
      </div>
    )
  }

  if (isError && !meals.length) {
    return (
      <div className="max-w-[1120px] mx-auto flex flex-col items-center justify-center py-24">
        <AlertCircle className="w-10 h-10 text-[var(--color-risk)] mb-4" />
        <h2 className="text-lg font-semibold mb-2">Unable to load meal analysis</h2>
        <button onClick={() => refetch()} className="flex items-center space-x-2 px-4 py-2 rounded-md bg-[var(--color-brand)] text-white text-[13px] font-medium mt-4 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-[1120px] mx-auto pb-16">
      <header className="pt-8 mb-10 max-w-[800px]">
        <h1 className="font-serif text-[28px] leading-[1.25] tracking-tight text-[var(--color-ink)] mb-2">
          Meals
        </h1>
        <p className="text-[15px] text-[var(--color-ink-secondary)] leading-relaxed">
          {insight}
        </p>
      </header>

      <MealsSummary meals={filteredMeals} totalDemand={totalFilteredDemand} bufferPct={bufferPct} topMeal={topMeal} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 flex flex-col gap-8">
          <MealsDistribution meals={filteredMeals} totalDemand={totalFilteredDemand} bufferPct={bufferPct} />
          <MealForecastExplorer meals={filteredMeals} bufferPct={bufferPct} filters={filters} />
        </div>
        <div>
          <MealsCategoryAnalysis meals={filteredMeals} totalDemand={totalFilteredDemand} filters={filters} setFilters={setFilters} />
        </div>
      </div>

      <MealsDirectory 
        meals={filteredMeals}
        totalDemand={totalFilteredDemand}
        filters={filters}
        setFilters={setFilters}
        bufferPct={bufferPct}
      />
    </div>
  )
}
