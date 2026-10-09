import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCenters } from '../lib/api'
import { CentersSummary } from '../components/centers/CentersSummary'
import { CentersDistribution } from '../components/centers/CentersDistribution'
import { CentersDirectory } from '../components/centers/CentersDirectory'
import { AlertCircle, RefreshCw, Search, X } from 'lucide-react'

export function Centers() {
  const [search, setSearch] = useState('')
  const { data, isLoading, isError, refetch } = useQuery({ 
    queryKey: ['centers'], 
    queryFn: getCenters, 
    staleTime: 5 * 60 * 1000 
  })

  const filteredData = useMemo(() => {
    if (!data) return []
    if (!search) return data
    const s = search.toLowerCase()
    return data.filter((c:any) => 
      c.simulated_city.toLowerCase().includes(s) || 
      c.center_type.toLowerCase().includes(s) || 
      `center ${c.center_id}`.includes(s) ||
      c.center_id.toString().includes(s)
    )
  }, [data, search])

  if (isLoading) {
    return (
      <div className="w-full animate-pulse">
        <div className="pt-6 lg:pt-8 mb-8 h-20 bg-[var(--color-border)] rounded-lg max-w-[800px]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />)}
        </div>
        <div className="h-[300px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl mb-8" />
        <div className="h-[400px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 w-full h-full">
        <div className="w-16 h-16 rounded-full bg-[var(--color-danger-bg)] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" />
        </div>
        <h2 className="text-lg font-heading font-bold text-[var(--color-text)] mb-2">Unable to load centers</h2>
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
          Fulfillment Centers
        </h1>
        <p className="text-[15px] font-medium text-[var(--color-text-secondary)]">
          Explore the operational footprint, region distribution, and specific center configurations.
        </p>
      </header>

      <div className="mb-6 relative max-w-md sticky top-0 z-20">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-10 py-3 border border-[var(--color-border)] rounded-xl text-[13px] font-medium bg-[var(--color-surface)] shadow-sm text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all"
          placeholder="Search by ID, City, or Type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <CentersSummary data={filteredData} totalCenters={data.length} />
      
      <div className="mb-8">
        <CentersDistribution data={filteredData} />
      </div>

      <CentersDirectory data={filteredData} />
    </div>
  )
}
