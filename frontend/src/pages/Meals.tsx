import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMeals } from '../lib/api'
import { MealsSummary } from '../components/meals/MealsSummary'
import { MealsDistribution } from '../components/meals/MealsDistribution'
import { MealsDirectory } from '../components/meals/MealsDirectory'
import { MealsCategoryAnalysis } from '../components/meals/MealsCategoryAnalysis'
import { AlertCircle, RefreshCw, Search, X } from 'lucide-react'

export function Meals() {
  const [search, setSearch] = useState('')
  const { data, isLoading, isError, refetch } = useQuery({ 
    queryKey: ['meals'], 
    queryFn: getMeals, 
    staleTime: 5 * 60 * 1000 
  })

  const filteredData = useMemo(() => {
    if (!data) return []
    if (!search) return data
    const s = search.toLowerCase()
    return data.filter((m:any) => 
      m.category.toLowerCase().includes(s) || 
      m.cuisine.toLowerCase().includes(s) || 
      `meal ${m.meal_id}`.includes(s) ||
      m.meal_id.toString().includes(s)
    )
  }, [data, search])

  if (isLoading) {
    return (
      <div className="w-full animate-pulse">
        <div className="pt-6 lg:pt-8 mb-8 h-20 bg-[var(--color-border)] rounded-lg max-w-[800px]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8">
          <div className="h-[300px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
          <div className="h-[300px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 w-full h-full">
        <div className="w-16 h-16 rounded-full bg-[var(--color-danger-bg)] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" />
        </div>
        <h2 className="text-lg font-heading font-bold text-[var(--color-text)] mb-2">Unable to load meals</h2>
        <button
          onClick={() => refetch()}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-[14px] font-semibold transition-colors shadow-sm mt-4"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    )
  }

  return (
    <div className="w-full pb-16 animate-in fade-in duration-500">
      <header className="pt-6 lg:pt-8 mb-8 max-w-[800px]">
        <h1 className="font-heading font-extrabold text-[28px] lg:text-[32px] leading-[1.2] tracking-tight text-[var(--color-text)] mb-2">
          Menu Catalog
        </h1>
        <p className="text-[15px] font-medium text-[var(--color-text-secondary)]">
          Analyze item configurations, price points, and categorical distribution.
        </p>
      </header>

      <div className="mb-6 relative max-w-md sticky top-0 z-20">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-10 py-3 border border-[var(--color-border)] rounded-xl text-[13px] font-medium bg-[var(--color-surface)] shadow-sm text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
          placeholder="Search by ID, Category, or Cuisine..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <MealsSummary data={filteredData} totalMeals={data.length} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8">
        <MealsDistribution data={filteredData} />
        <MealsCategoryAnalysis data={filteredData} />
      </div>

      <MealsDirectory data={filteredData} />
    </div>
  )
}
