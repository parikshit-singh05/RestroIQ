import { Tag } from 'lucide-react'

export function AnalyticsPromotions({ promo }: { promo: any }) {
  if (!promo.emailer) return null
  
  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] p-6 shadow-sm" aria-label="Promotion Analysis">
      <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-[var(--color-border-subtle)]">
        <Tag className="w-4 h-4 text-[var(--color-accent)]" />
        <h3 className="text-[16px] font-heading font-bold tracking-tight text-[var(--color-text)]">Promotion Lift</h3>
      </div>
      
      <div className="space-y-8">
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
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-[12px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{title}</h4>
        {diff > 0 && <span className="text-[11px] font-bold text-[var(--color-success)] bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 px-2 py-0.5 rounded-full">+{diff.toFixed(1)}% lift</span>}
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
      <div className="w-[120px] font-medium text-[var(--color-text-secondary)] truncate pr-2">{label}</div>
      <div className="flex-1 flex items-center h-6">
        <div 
          className={`h-full rounded-r-md transition-all duration-500 ${highlight ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-alt)] border border-[var(--color-border)]'}`} 
          style={{ width: `${Math.max((val/max)*100, 2)}%` }}
        />
        <span className={`ml-3 font-bold tabular-nums ${highlight ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>
          {Math.round(val).toLocaleString('en-IN')}
        </span>
        <span className="ml-2 text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tabular-nums">n={n.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}