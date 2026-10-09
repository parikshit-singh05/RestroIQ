export function AnalyticsPromotions({ promo }: { promo: any }) {
  if (!promo.emailer) return null
  
  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 mb-8 flex-1" aria-label="Promotion Analysis">
      <div className="mb-6">
        <h3 className="text-[15px] font-semibold tracking-tight">Promotion Analysis</h3>
        <p className="text-[13px] text-[var(--color-ink-secondary)] mt-0.5">
          Comparison of average observed demand based on promotional conditions.
        </p>
      </div>
      
      <div className="space-y-6">
        <PromoComparison title="Emailer Promotion" data={promo.emailer} />
        <PromoComparison title="Homepage Featured" data={promo.homepage} />
      </div>
    </div>
  )
}

function PromoComparison({ title, data }: { title: string, data: any }) {
  if (!data.yes_n && !data.no_n) return null
  
  const diff = data.no ? ((data.yes - data.no) / data.no) * 100 : 0
  const max = Math.max(data.yes, data.no) || 1
  
  return (
    <div>
      <div className="flex justify-between items-baseline mb-3">
        <h4 className="text-[12px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider">{title}</h4>
        {diff > 0 && <span className="text-[11px] font-medium text-[var(--color-brand)] bg-[rgba(224,73,43,0.06)] px-1.5 py-0.5 rounded">+{diff.toFixed(1)}% diff</span>}
      </div>
      
      <div className="space-y-3">
        <BarRow label="No Promotion" val={data.no} max={max} n={data.no_n} />
        <BarRow label="Active Promotion" val={data.yes} max={max} n={data.yes_n} highlight />
      </div>
    </div>
  )
}

function BarRow({ label, val, max, n, highlight }: any) {
  return (
    <div className="flex items-center text-[13px]">
      <div className="w-[120px] text-[var(--color-ink-secondary)] truncate pr-2">{label}</div>
      <div className="flex-1 flex items-center h-5">
        <div 
          className={`h-full rounded-r-sm transition-all duration-500 ${highlight ? 'bg-[var(--color-brand)]' : 'bg-[rgba(20,19,15,0.1)]'}`} 
          style={{ width: `${Math.max((val/max)*100, 2)}%` }}
        />
        <span className={`ml-2 font-medium tabular-nums ${highlight ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink)]'}`}>
          {Math.round(val).toLocaleString('en-IN')}
        </span>
        <span className="ml-2 text-[10px] text-[var(--color-ink-secondary)] tabular-nums">(n={n.toLocaleString('en-IN')})</span>
      </div>
    </div>
  )
}
