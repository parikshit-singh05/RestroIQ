import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import type { DetailedForecast } from '../../lib/types'
import { useAppContext } from '../../context/AppContext'

interface Props {
  data: DetailedForecast[]
}

type SortKey = 'predicted_orders' | 'center_id' | 'meal_id' | 'checkout_price'
type SortOrder = 'asc' | 'desc'

export function ForecastTable({ data }: Props) {
  const { buffer } = useAppContext()
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('predicted_orders')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const rowsPerPage = 20

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let valA = a[sortKey]
      let valB = b[sortKey]
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA))
      }
      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number)
    })
  }, [data, sortKey, sortOrder])

  const totalPages = Math.ceil(sortedData.length / rowsPerPage)
  const paginatedData = sortedData.slice(page * rowsPerPage, (page + 1) * rowsPerPage)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('desc')
    }
    setPage(0)
  }

  const SortIcon = ({ active }: { active: boolean }) => (
    <ArrowUpDown className={`w-3 h-3 inline-block ml-1.5 transition-opacity ${active ? 'opacity-100 text-[var(--color-brand)]' : 'opacity-0 group-hover:opacity-40'}`} />
  )

  if (!data.length) {
    return (
      <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-12 text-center text-[var(--color-ink-secondary)] text-[13px]">
        No forecast data matches the current filters.
      </div>
    )
  }

  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] overflow-hidden flex flex-col" aria-label="Detailed forecast table">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-[13px] whitespace-nowrap">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[rgba(20,19,15,0.02)]">
              <th className="font-medium text-[var(--color-ink-secondary)] py-3 px-5 group cursor-pointer" onClick={() => handleSort('center_id')}>
                Center <SortIcon active={sortKey === 'center_id'} />
              </th>
              <th className="font-medium text-[var(--color-ink-secondary)] py-3 px-5 group cursor-pointer" onClick={() => handleSort('meal_id')}>
                Meal <SortIcon active={sortKey === 'meal_id'} />
              </th>
              <th className="font-medium text-[var(--color-ink-secondary)] py-3 px-5 group cursor-pointer text-right" onClick={() => handleSort('checkout_price')}>
                Checkout Price <SortIcon active={sortKey === 'checkout_price'} />
              </th>
              <th className="font-medium text-[var(--color-ink-secondary)] py-3 px-5 group cursor-pointer text-right" onClick={() => handleSort('predicted_orders')}>
                Predicted <SortIcon active={sortKey === 'predicted_orders'} />
              </th>
              {buffer > 0 && (
                <th className="font-medium text-[var(--color-brand)] py-3 px-5 text-right">
                  Prep (+{buffer}%)
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {paginatedData.map((row) => {
              const prep = row.predicted_orders * (1 + buffer / 100)
              return (
                <tr key={row.id} className="hover:bg-[rgba(20,19,15,0.015)] transition-colors">
                  <td className="py-2.5 px-5">
                    <div className="font-medium text-[var(--color-ink)]">Center {row.center_id}</div>
                    <div className="text-[11px] text-[var(--color-ink-secondary)]">{row.simulated_city}</div>
                  </td>
                  <td className="py-2.5 px-5">
                    <div className="font-medium text-[var(--color-ink)]">Meal {row.meal_id}</div>
                    <div className="text-[11px] text-[var(--color-ink-secondary)]">{row.category} &middot; {row.cuisine}</div>
                  </td>
                  <td className="py-2.5 px-5 text-right tabular-nums text-[var(--color-ink-secondary)]">₹{row.checkout_price.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-5 text-right tabular-nums font-medium">
                    {Math.round(row.predicted_orders).toLocaleString('en-IN')}
                  </td>
                  {buffer > 0 && (
                    <td className="py-2.5 px-5 text-right tabular-nums text-[var(--color-ink-secondary)]">
                      {Math.round(prep).toLocaleString('en-IN')}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-[var(--color-hairline)] py-3 px-5 flex items-center justify-between bg-[rgba(20,19,15,0.01)] text-[12px]">
          <span className="text-[var(--color-ink-secondary)]">
            Showing {page * rowsPerPage + 1} - {Math.min((page + 1) * rowsPerPage, sortedData.length)} of {sortedData.length.toLocaleString('en-IN')} predictions
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded text-[var(--color-ink-secondary)] hover:bg-[rgba(20,19,15,0.05)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-[var(--color-ink)]">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded text-[var(--color-ink-secondary)] hover:bg-[rgba(20,19,15,0.05)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}