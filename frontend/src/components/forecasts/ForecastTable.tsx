import { useState } from 'react'
import { formatCompact } from '../../lib/format'
import { useAppContext } from '../../context/AppContext'
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ForecastTable({ data }: { data: any[] }) {
  const { buffer } = useAppContext()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' }>({ key: 'predicted_orders', direction: 'desc' })

  const sortedData = [...data].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize)

  const requestSort = (key: string) => {
    let direction: 'asc'|'desc' = 'desc'
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc'
    setSortConfig({ key, direction })
    setPage(1)
  }

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortConfig.key !== colKey) return <ChevronDown className="w-3 h-3 text-[var(--color-border)] ml-1 opacity-0 group-hover:opacity-100" />
    return sortConfig.direction === 'desc' 
      ? <ChevronDown className="w-3 h-3 text-[var(--color-accent)] ml-1" />
      : <ChevronUp className="w-3 h-3 text-[var(--color-accent)] ml-1" />
  }

  const TH = ({ label, colKey, align = 'left' }: any) => (
    <th 
      className={`py-3.5 px-4 text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider cursor-pointer group select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => requestSort(colKey)}
    >
      <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {label} <SortIcon colKey={colKey} />
      </div>
    </th>
  )

  if (!data.length) return <div className="p-8 text-center text-[13px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">No matching records found.</div>

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
              <TH label="Week" colKey="week" />
              <TH label="Center" colKey="center_id" />
              <TH label="Meal" colKey="meal_id" />
              <TH label="Cuisine" colKey="cuisine" />
              <TH label="Price" colKey="checkout_price" align="right" />
              <TH label="Predicted" colKey="predicted_orders" align="right" />
              <TH label="Prep Target" colKey="predicted_orders" align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {paginatedData.map((d, i) => (
              <tr key={i} className="hover:bg-[var(--color-surface-alt)]/50 transition-colors group">
                <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-text)]">
                  W{d.week}
                </td>
                <td className="py-3 px-4">
                  <Link to={`/centers/${d.center_id}`} className="block">
                    <div className="text-[13px] font-bold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">Center {d.center_id}</div>
                    <div className="text-[11px] font-medium text-[var(--color-text-tertiary)] flex items-center mt-0.5">
                      <MapPin className="w-3 h-3 mr-1" /> {d.simulated_city}
                    </div>
                  </Link>
                </td>
                <td className="py-3 px-4">
                  <Link to={`/meals/${d.meal_id}`} className="block">
                    <div className="text-[13px] font-bold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">Meal {d.meal_id}</div>
                    <div className="text-[11px] font-medium text-[var(--color-text-tertiary)] mt-0.5">{d.category}</div>
                  </Link>
                </td>
                <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-text-secondary)]">
                  {d.cuisine}
                </td>
                <td className="py-3 px-4 text-[13px] font-medium tabular-nums text-[var(--color-text)] text-right">
                  ${d.checkout_price.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-[13px] font-bold tabular-nums text-[var(--color-text)] text-right">
                  {formatCompact(d.predicted_orders)}
                </td>
                <td className="py-3 px-4 text-[13px] font-bold tabular-nums text-[var(--color-success)] text-right">
                  {formatCompact(d.predicted_orders * (1 + buffer / 100))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-alt)]">
          <span className="text-[12px] font-bold text-[var(--color-text-tertiary)] uppercase">
            Page {page} of {totalPages}
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-[12px] font-bold text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md hover:text-[var(--color-text)] disabled:opacity-50 transition-colors shadow-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-[12px] font-bold text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md hover:text-[var(--color-text)] disabled:opacity-50 transition-colors shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}