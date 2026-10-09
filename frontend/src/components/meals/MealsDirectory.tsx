import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UtensilsCrossed, ArrowRight, Tag } from 'lucide-react'

export function MealsDirectory({ data }: { data: any[] }) {
  const [page, setPage] = useState(1)
  const pageSize = 16

  if (!data.length) return <div className="p-8 text-center text-[13px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">No meals match the current filter.</div>

  const sortedData = [...data].sort((a, b) => a.meal_id - b.meal_id)
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {paginatedData.map(m => (
          <Link 
            key={m.meal_id} 
            to={`/meals/${m.meal_id}`} 
            className="group bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-full"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-accent-subtle)] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UtensilsCrossed className="w-5 h-5 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-heading font-bold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">Meal {m.meal_id}</h3>
                  <div className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mt-0.5">
                    {m.category}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-[12px] font-bold text-[var(--color-text-secondary)] mb-4 bg-[var(--color-surface-alt)] px-2 py-1 rounded w-max">
              <Tag className="w-3 h-3 text-[var(--color-text-tertiary)]" />
              <span>{m.cuisine}</span>
            </div>
            
            <div className="mt-auto pt-4 flex items-center justify-between border-t border-[var(--color-border-subtle)]">
              <span className="text-[12px] font-bold text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity">View details</span>
              <ArrowRight className="w-4 h-4 text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-4 mt-8">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-[13px] font-bold rounded-lg border border-[var(--color-border)] disabled:opacity-50 hover:bg-[var(--color-surface-alt)] text-[var(--color-text)] transition-colors shadow-sm bg-[var(--color-surface)]"
          >
            Previous
          </button>
          <span className="text-[13px] font-bold text-[var(--color-text-secondary)]">Page {page} of {totalPages}</span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-[13px] font-bold rounded-lg border border-[var(--color-border)] disabled:opacity-50 hover:bg-[var(--color-surface-alt)] text-[var(--color-text)] transition-colors shadow-sm bg-[var(--color-surface)]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
