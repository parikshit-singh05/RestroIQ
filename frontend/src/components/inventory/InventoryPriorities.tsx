import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight,  Focus } from 'lucide-react'
import type { InventoryRecommendation } from '../../lib/types'
import { useAppContext } from '../../context/AppContext'
import { formatCompact } from '../../lib/format'

interface Props {
  data: (InventoryRecommendation & { simulated_city?: string, category?: string, cuisine?: string })[]
}

// // type SortKey = 'predicted_orders' | 'prep' | 'buffer'
// // type SortOrder = 'asc' | 'desc'

export function InventoryPriorities({ data }: Props) {
  const { buffer } = useAppContext()
  const [page, setPage] = useState(0)
  const rowsPerPage = 15

  const sortedData = useMemo(() => {
    return [...data].map(d => {
      const prepKey = `prep_${buffer}pct` as keyof typeof d
      const bufKey = buffer > 0 ? `potential_surplus_${buffer}pct` : 'potential_surplus_10pct'
      return {
        ...d,
        computed_prep: (d[prepKey] as number) || (d.predicted_orders * (1 + buffer / 100)),
        computed_buf: buffer > 0 ? ((d[bufKey as keyof typeof d] as number) || (d.predicted_orders * buffer / 100)) : 0
      }
    }).sort((a, b) => b.computed_prep - a.computed_prep)
  }, [data, buffer])

  const totalPages = Math.ceil(sortedData.length / rowsPerPage)
  const paginatedData = sortedData.slice(page * rowsPerPage, (page + 1) * rowsPerPage)

  if (!data.length) return null

  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] overflow-hidden flex flex-col" aria-label="Preparation priorities table">
      <div className="p-5 border-b border-[var(--color-hairline)]">
        <div className="flex items-center space-x-2">
          <Focus className="w-4 h-4 text-[var(--color-ink-secondary)]" />
          <h3 className="text-[15px] font-semibold tracking-tight">Preparation Priorities</h3>
        </div>
        <p className="text-[12px] text-[var(--color-ink-secondary)] mt-1">
          Largest preparation requirements ranked deterministically by total planned volume.
        </p>
      </div>
      
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-[13px] whitespace-nowrap">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[rgba(20,19,15,0.02)]">
              <th className="font-medium text-[var(--color-ink-secondary)] py-3 px-5 w-12">#</th>
              <th className="font-medium text-[var(--color-ink-secondary)] py-3 px-5">Center & City</th>
              <th className="font-medium text-[var(--color-ink-secondary)] py-3 px-5">Meal Info</th>
              <th className="font-medium text-[var(--color-ink-secondary)] py-3 px-5">Week</th>
              <th className="font-medium text-[var(--color-ink-secondary)] py-3 px-5 text-right">Predicted</th>
              <th className="font-medium text-[var(--color-brand)] py-3 px-5 text-right">Preparation ({buffer}%)</th>
              {buffer > 0 && <th className="font-medium text-[var(--color-ink-secondary)] py-3 px-5 text-right">Buffer Vol.</th>}
              
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {paginatedData.map((row, i) => (
              <tr key={`${row.week}-${row.center_id}-${row.meal_id}`} className="hover:bg-[rgba(20,19,15,0.015)] transition-colors">
                <td className="py-2.5 px-5 text-[var(--color-ink-secondary)] tabular-nums text-[12px]">
                  {page * rowsPerPage + i + 1}
                </td>
                <td className="py-2.5 px-5">
                  <div className="font-medium text-[var(--color-ink)]">Center {row.center_id}</div>
                  <div className="text-[11px] text-[var(--color-ink-secondary)]">{row.simulated_city || "Unknown City"}</div>
                </td>
                <td className="py-2.5 px-5">
                  <div className="font-medium text-[var(--color-ink)]">Meal {row.meal_id}</div>
                  <div className="text-[11px] text-[var(--color-ink-secondary)]">{row.category || "Unknown"} &middot; {row.cuisine || "Unknown"}</div>
                </td>
                <td className="py-2.5 px-5 text-[var(--color-ink-secondary)] tabular-nums">
                  W{row.week}
                </td>
                <td className="py-2.5 px-5 text-right tabular-nums text-[var(--color-ink-secondary)]">
                  <span title={Math.round(row.predicted_orders).toLocaleString('en-IN')}>{formatCompact(row.predicted_orders)}</span>
                </td>
                <td className="py-2.5 px-5 text-right tabular-nums font-semibold text-[var(--color-brand)]">
                  <span title={Math.round(row.computed_prep).toLocaleString('en-IN')}>{formatCompact(row.computed_prep)}</span>
                </td>
                {buffer > 0 && (
                  <td className="py-2.5 px-5 text-right tabular-nums text-[var(--color-ink-secondary)]">
                    +<span title={Math.round(row.computed_buf).toLocaleString('en-IN')}>{formatCompact(row.computed_buf)}</span>
                  </td>
                )}
                
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="border-t border-[var(--color-hairline)] py-3 px-5 flex items-center justify-between bg-[rgba(20,19,15,0.01)] text-[12px]">
          <span className="text-[var(--color-ink-secondary)]">
            Showing {page * rowsPerPage + 1} - {Math.min((page + 1) * rowsPerPage, sortedData.length)} of {sortedData.length.toLocaleString('en-IN')} combinations
          </span>
          <div className="flex items-center space-x-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded text-[var(--color-ink-secondary)] hover:bg-[rgba(20,19,15,0.05)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-[var(--color-ink)]">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="p-1.5 rounded text-[var(--color-ink-secondary)] hover:bg-[rgba(20,19,15,0.05)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
