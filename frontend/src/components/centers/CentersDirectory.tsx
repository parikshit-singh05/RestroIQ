import { Link } from 'react-router-dom'
import { MapPin, ArrowRight, Building2 } from 'lucide-react'

export function CentersDirectory({ data }: { data: any[] }) {
  if (!data.length) return <div className="p-8 text-center text-[13px] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">No centers match the current filter.</div>

  const sortedData = [...data].sort((a, b) => a.center_id - b.center_id)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {sortedData.map(c => (
        <Link 
          key={c.center_id} 
          to={`/centers/${c.center_id}`} 
          className="group bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-full"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-accent-subtle)] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <h3 className="text-[15px] font-heading font-bold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">Center {c.center_id}</h3>
                <div className="flex items-center text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mt-0.5">
                  <MapPin className="w-3 h-3 mr-1" />
                  {c.simulated_city}
                </div>
              </div>
            </div>
            <span className="px-2 py-1 rounded bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[11px] font-bold text-[var(--color-text-secondary)]">
              {c.center_type}
            </span>
          </div>
          
          <div className="mt-auto pt-4 flex items-center justify-between border-t border-[var(--color-border-subtle)] text-[12px] font-bold text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity">
            <span>View forecast details</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      ))}
    </div>
  )
}