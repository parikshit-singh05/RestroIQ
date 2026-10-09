import { useState, useMemo, useEffect } from 'react'
import type { MealAnalysis } from '../../lib/types'
import { formatCompact, formatFull } from '../../lib/format'
import { getDistinct } from '../../lib/computations'
import type { MealsFilterState } from '../../pages/Meals'
import { Search, ChevronDown, ChevronUp, Tag, Utensils, TrendingUp, Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useQuery } from '@tanstack/react-query'

interface Props {
  meals: MealAnalysis[]
  totalDemand: number
  filters: MealsFilterState
  setFilters: (f: MealsFilterState) => void
  bufferPct: number
}

type SortCol = 'id' | 'category' | 'cuisine' | 'predicted' | 'share' | 'prep' | 'peak'
type SortDir = 'asc' | 'desc'

export function MealsDirectory({ meals, totalDemand, filters, setFilters, bufferPct }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>('predicted')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const navigate = useNavigate()

  const { data: rawMeals = [] } = useQuery({
    queryKey: ['raw_meals_for_filters'],
    queryFn: async () => { const res = await api.get('/meals'); return res.data }
  })
  
  const { data: centers = [] } = useQuery({
    queryKey: ['centers_for_filters'],
    queryFn: async () => { const res = await api.get('/centers'); return res.data }
  })

  const distinctCategories = useMemo(() => getDistinct(rawMeals, 'category'), [rawMeals])
  const distinctCuisines = useMemo(() => getDistinct(rawMeals, 'cuisine'), [rawMeals])
  const distinctCities = useMemo(() => getDistinct(centers, 'simulated_city'), [centers])
  
  const applicableCenters = useMemo(() => {
    return filters.city ? centers.filter((c: any) => c.simulated_city === filters.city) : centers
  }, [centers, filters.city])
  
  useEffect(() => {
    if (filters.city && filters.center_id !== '') {
      const valid = applicableCenters.some((c: any) => c.center_id === filters.center_id)
      if (!valid) {
        setFilters({ ...filters, center_id: '' })
      }
    }
  }, [filters.city, applicableCenters])

  const sortedMeals = useMemo(() => {
    return [...meals].sort((a, b) => {
      let aVal: any = a.predicted_orders
      let bVal: any = b.predicted_orders
      
      if (sortCol === 'id') { aVal = a.meal_id; bVal = b.meal_id }
      if (sortCol === 'category') { aVal = a.category; bVal = b.category }
      if (sortCol === 'cuisine') { aVal = a.cuisine; bVal = b.cuisine }
      if (sortCol === 'predicted') { aVal = a.predicted_orders; bVal = b.predicted_orders }
      if (sortCol === 'share') { aVal = totalDemand > 0 ? a.predicted_orders / totalDemand : 0; bVal = totalDemand > 0 ? b.predicted_orders / totalDemand : 0 }
      if (sortCol === 'prep') { aVal = a.predicted_orders * (1 + bufferPct); bVal = b.predicted_orders * (1 + bufferPct) }
      if (sortCol === 'peak') { aVal = a.peak_week; bVal = b.peak_week }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [meals, sortCol, sortDir, bufferPct, totalDemand])
  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return null
    return sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline ml-1" /> : <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
  }

  return (
    <div className="mb-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-4 px-10 -mx-10 border-y border-[var(--color-hairline)] mb-8 sticky top-0 z-20 backdrop-blur-md bg-[var(--color-surface)]/95 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-[280px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-secondary)]" />
            <input 
              type="text" 
              placeholder="Search meal ID, category..." 
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-4 h-[32px] bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] outline-none focus:border-[var(--color-brand)] transition-colors"
            />
          </div>
          
          <div className="flex items-center bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] h-[32px]">
            <span className="px-3 text-[var(--color-ink-secondary)] font-medium border-r border-[var(--color-hairline)] h-full flex items-center">
              Week
            </span>
            <select
              value={filters.week}
              onChange={(e) => setFilters({ ...filters, week: e.target.value ? Number(e.target.value) : '' })}
              className="bg-transparent pl-3 pr-8 h-full outline-none font-semibold cursor-pointer appearance-none truncate max-w-[100px]"
              style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All 10</option>
              {[...Array(10)].map((_, i) => <option key={146+i} value={146+i}>W{146+i}</option>)}
            </select>
          </div>

          <div className="flex items-center bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] h-[32px]">
            <span className="px-3 text-[var(--color-ink-secondary)] font-medium border-r border-[var(--color-hairline)] h-full flex items-center">
              City
            </span>
            <select
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              className="bg-transparent pl-3 pr-8 h-full outline-none font-semibold cursor-pointer appearance-none truncate max-w-[120px]"
              style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All Cities</option>
              {distinctCities.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-center bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] h-[32px]">
            <span className="px-3 text-[var(--color-ink-secondary)] font-medium border-r border-[var(--color-hairline)] h-full flex items-center">
              Center
            </span>
            <select
              value={filters.center_id}
              onChange={(e) => setFilters({ ...filters, center_id: e.target.value ? Number(e.target.value) : '' })}
              className="bg-transparent pl-3 pr-8 h-full outline-none font-semibold cursor-pointer appearance-none truncate max-w-[120px]"
              style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All Centers</option>
              {applicableCenters.map((c: any) => <option key={c.center_id} value={c.center_id}>Center {c.center_id}</option>)}
            </select>
          </div>
          <div className="flex items-center bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] h-[32px]">
            <span className="px-3 text-[var(--color-ink-secondary)] font-medium border-r border-[var(--color-hairline)] h-full flex items-center">
              Category
            </span>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="bg-transparent pl-3 pr-8 h-full outline-none font-semibold cursor-pointer appearance-none truncate max-w-[140px]"
              style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All</option>
              {distinctCategories.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-center bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] h-[32px]">
            <span className="px-3 text-[var(--color-ink-secondary)] font-medium border-r border-[var(--color-hairline)] h-full flex items-center">
              Cuisine
            </span>
            <select
              value={filters.cuisine}
              onChange={(e) => setFilters({ ...filters, cuisine: e.target.value })}
              className="bg-transparent pl-3 pr-8 h-full outline-none font-semibold cursor-pointer appearance-none truncate max-w-[140px]"
              style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All</option>
              {distinctCuisines.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-[var(--color-hairline)] rounded-lg bg-white shadow-sm">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[rgba(20,19,15,0.02)]">
              <th onClick={() => handleSort('id')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors">
                Meal ID <SortIcon col="id" />
              </th>
              <th onClick={() => handleSort('category')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors">
                Category <SortIcon col="category" />
              </th>
              <th onClick={() => handleSort('cuisine')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors">
                Cuisine <SortIcon col="cuisine" />
              </th>
              <th onClick={() => handleSort('predicted')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors text-right">
                Forecast <SortIcon col="predicted" />
              </th>
              <th onClick={() => handleSort('prep')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors text-right">
                Prep Req <SortIcon col="prep" />
              </th>
              <th onClick={() => handleSort('share')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors text-right">
                Share of View <SortIcon col="share" />
              </th>
              <th onClick={() => handleSort('peak')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors text-right">
                Peak <SortIcon col="peak" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMeals.map(m => (
              <tr 
                key={m.meal_id} 
                onClick={() => navigate(`/meals/${m.meal_id}`)}
                className="border-b border-[var(--color-hairline)] last:border-0 hover:bg-[rgba(20,19,15,0.02)] transition-colors cursor-pointer group"
              >
                <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-brand)] transition-colors">
                  Meal {m.meal_id}
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-ink)]">
                  <div className="flex items-center space-x-1.5">
                    <Tag className="w-3.5 h-3.5 text-[var(--color-ink-secondary)]" />
                    <span>{m.category}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-ink)]">
                  <div className="flex items-center space-x-1.5">
                    <Utensils className="w-3.5 h-3.5 text-[var(--color-ink-secondary)]" />
                    <span>{m.cuisine}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-ink)] text-right">
                  <div className="flex items-center justify-end space-x-1.5">
                    <TrendingUp className="w-3 h-3 text-[var(--color-growth)]" />
                    <span title={formatFull(m.predicted_orders)}>{formatCompact(m.predicted_orders)}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-ink)] text-right">
                  <div className="flex items-center justify-end space-x-1.5">
                    <Package className="w-3 h-3 text-[var(--color-caution)]" />
                    <span title={formatFull(m.predicted_orders * (1 + bufferPct))}>{formatCompact(m.predicted_orders * (1 + bufferPct))}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-ink-secondary)] text-right font-mono">
                  {totalDemand > 0 ? ((m.predicted_orders / totalDemand) * 100).toFixed(1) : '0.0'}%
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-ink)] text-right">
                  W{m.peak_week}
                </td>
              </tr>
            ))}
            {sortedMeals.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[13px] text-[var(--color-ink-secondary)]">
                  No meals match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
