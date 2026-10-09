import { useState, useMemo } from 'react'
import type { CenterAnalysis } from '../../lib/types'
import { formatCompact, formatFull } from '../../lib/format'
import { getDistinct } from '../../lib/computations'
import type { CentersFilterState } from '../../pages/Centers'
import { Search, ChevronDown, ChevronUp, MapPin, Building2, TrendingUp, Package } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
  centers: CenterAnalysis[]
  allCenters: CenterAnalysis[]
  filters: CentersFilterState
  setFilters: (f: CentersFilterState) => void
  bufferPct: number
}

type SortCol = 'id' | 'city' | 'type' | 'area' | 'predicted' | 'share' | 'prep' | 'peak'
type SortDir = 'asc' | 'desc'

export function CentersDirectory({ centers, allCenters, filters, setFilters, bufferPct }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>('predicted')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const navigate = useNavigate()

  const distinctCities = useMemo(() => getDistinct(allCenters, 'simulated_city'), [allCenters])
  const distinctTypes = useMemo(() => getDistinct(allCenters, 'center_type'), [allCenters])

  const totalFilteredDemand = useMemo(() => centers.reduce((sum, c) => sum + c.predicted_orders, 0), [centers])

  const sortedCenters = useMemo(() => {
    return [...centers].sort((a, b) => {
      let aVal: any = a.predicted_orders
      let bVal: any = b.predicted_orders
      
      if (sortCol === 'id') { aVal = a.center_id; bVal = b.center_id }
      if (sortCol === 'city') { aVal = a.simulated_city; bVal = b.simulated_city }
      if (sortCol === 'type') { aVal = a.center_type; bVal = b.center_type }
      if (sortCol === 'area') { aVal = a.op_area; bVal = b.op_area }
      if (sortCol === 'predicted') { aVal = a.predicted_orders; bVal = b.predicted_orders }
      if (sortCol === 'share') { aVal = totalFilteredDemand > 0 ? (a.predicted_orders / totalFilteredDemand) * 100 : 0; bVal = totalFilteredDemand > 0 ? (b.predicted_orders / totalFilteredDemand) * 100 : 0 }
      if (sortCol === 'prep') { aVal = a.predicted_orders * (1 + bufferPct); bVal = b.predicted_orders * (1 + bufferPct) }
      if (sortCol === 'peak') { aVal = a.peak_week; bVal = b.peak_week }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [centers, sortCol, sortDir, bufferPct, totalFilteredDemand])

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
      {/* Sticky Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 px-10 -mx-10 border-y border-[var(--color-hairline)] mb-8 sticky top-0 z-20 backdrop-blur-md bg-[var(--color-surface)]/95 shadow-sm">
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-secondary)]" />
            <input 
              type="text" 
              placeholder="Search center ID or city..." 
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-4 h-[32px] bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] outline-none focus:border-[var(--color-brand)] transition-colors"
            />
          </div>
          
          <div className="flex items-center bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] h-[32px]">
            <span className="px-3 text-[var(--color-ink-secondary)] font-medium border-r border-[var(--color-hairline)] h-full flex items-center">
              City
            </span>
            <select
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              className="bg-transparent pl-3 pr-8 h-full outline-none font-semibold cursor-pointer appearance-none truncate max-w-[140px]"
              style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All Cities</option>
              {distinctCities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-center bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-md text-[12px] h-[32px]">
            <span className="px-3 text-[var(--color-ink-secondary)] font-medium border-r border-[var(--color-hairline)] h-full flex items-center">
              Type
            </span>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="bg-transparent pl-3 pr-8 h-full outline-none font-semibold cursor-pointer appearance-none truncate max-w-[140px]"
              style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="">All Types</option>
              {distinctTypes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-[var(--color-hairline)] rounded-lg bg-white shadow-sm">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[rgba(20,19,15,0.02)]">
              <th onClick={() => handleSort('id')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors">
                Center ID <SortIcon col="id" />
              </th>
              <th onClick={() => handleSort('city')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors">
                Location <SortIcon col="city" />
              </th>
              <th onClick={() => handleSort('type')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors">
                Type <SortIcon col="type" />
              </th>
              <th onClick={() => handleSort('area')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors text-right">
                Op Area <SortIcon col="area" />
              </th>
              <th onClick={() => handleSort('predicted')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors text-right">
                10-W Forecast <SortIcon col="predicted" />
              </th>
              <th onClick={() => handleSort('prep')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors text-right">
                Prep Req <SortIcon col="prep" />
              </th>
              <th onClick={() => handleSort('share')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors text-right">
                Share <SortIcon col="share" />
              </th>
              <th onClick={() => handleSort('peak')} className="py-3 px-4 text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider cursor-pointer hover:bg-black/5 transition-colors text-right">
                Peak <SortIcon col="peak" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCenters.map(c => (
              <tr 
                key={c.center_id} 
                onClick={() => navigate(`/centers/${c.center_id}`)}
                className="border-b border-[var(--color-hairline)] last:border-0 hover:bg-[rgba(20,19,15,0.02)] transition-colors cursor-pointer group"
              >
                <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-brand)] transition-colors">
                  {c.center_id}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-[var(--color-ink-secondary)]" />
                    <div>
                      <div className="text-[13px] font-medium text-[var(--color-ink)]">{c.simulated_city}</div>
                      <div className="text-[11px] text-[var(--color-ink-secondary)]">Simulated location</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-ink)]">
                  <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-sm bg-[rgba(20,19,15,0.04)] text-[12px] font-medium">
                    <Building2 className="w-3 h-3 text-[var(--color-ink-secondary)]" />
                    <span>{c.center_type}</span>
                  </span>
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-ink-secondary)] text-right font-mono">
                  {c.op_area.toFixed(1)}
                </td>
                <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-ink)] text-right">
                  <div className="flex items-center justify-end space-x-1.5">
                    <TrendingUp className="w-3 h-3 text-[var(--color-growth)]" />
                    <span title={formatFull(c.predicted_orders)}>{formatCompact(c.predicted_orders)}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-ink)] text-right">
                  <div className="flex items-center justify-end space-x-1.5">
                    <Package className="w-3 h-3 text-[var(--color-caution)]" />
                    <span title={formatFull(c.predicted_orders * (1 + bufferPct))}>{formatCompact(c.predicted_orders * (1 + bufferPct))}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-ink-secondary)] text-right font-mono">
                  {totalFilteredDemand > 0 ? ((c.predicted_orders / totalFilteredDemand) * 100).toFixed(1) : '0.0'}%
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-ink)] text-right">
                  W{c.peak_week}
                </td>
              </tr>
            ))}
            {sortedCenters.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[13px] text-[var(--color-ink-secondary)]">
                  No centers match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
