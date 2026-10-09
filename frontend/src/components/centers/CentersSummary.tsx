export function CentersSummary({ data, totalCenters }: { data: any[], totalCenters: number }) {
  if (!data.length) return null

  const distinctCities = new Set(data.map(d => d.simulated_city)).size
  
  const typeMap = new Map<string, number>()
  data.forEach(d => {
    typeMap.set(d.center_type, (typeMap.get(d.center_type) || 0) + 1)
  })
  
  let topType = { name: '', count: 0 }
  typeMap.forEach((v, k) => {
    if (v > topType.count) topType = { name: k, count: v }
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Total Locations</p>
        <div className="flex items-baseline space-x-2">
          <p className="text-[32px] font-heading font-bold tabular-nums text-[var(--color-text)] leading-none">{data.length}</p>
          {data.length !== totalCenters && (
            <span className="text-[13px] font-bold text-[var(--color-text-tertiary)]">of {totalCenters}</span>
          )}
        </div>
      </div>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Simulated Cities</p>
        <p className="text-[32px] font-heading font-bold tabular-nums text-[var(--color-text)] leading-none">{distinctCities}</p>
      </div>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">Primary Typology</p>
        <div className="flex items-baseline space-x-2">
          <p className="text-[32px] font-heading font-bold text-[var(--color-text)] leading-none">{topType.name}</p>
        </div>
      </div>
    </div>
  )
}