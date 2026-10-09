import { CloudRain, Calendar } from 'lucide-react'

export function AnalyticsContext({ ctx }: { ctx: any }) {
  if (!ctx.holiday) return null
  
  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[var(--color-surface)] p-6 mb-8 flex-1" aria-label="Weather and Holiday Context">
      <div className="mb-6">
        <h3 className="text-[15px] font-semibold tracking-tight">Environmental Context</h3>
        <p className="text-[13px] text-[var(--color-ink-secondary)] mt-0.5">
          Associations observed alongside simulated weather and holidays.
        </p>
      </div>
      
      <div className="space-y-6">
        <ContextComparison 
          icon={<Calendar className="w-4 h-4" />} 
          title="Holiday Presence" 
          data={ctx.holiday} 
          labels={['Non-Holiday Week', 'Holiday Week']} 
        />
        <div className="pt-4 border-t border-[rgba(20,19,15,0.06)]">
          <ContextComparison 
            icon={<CloudRain className="w-4 h-4" />} 
            title="Previous-week precipitation" 
            data={ctx.rain} 
            labels={['No Rain', 'Rain (>0mm)']} 
          />
          <p className="text-[11px] text-[var(--color-ink-secondary)] leading-relaxed mt-4">
            Weather and calendar variables show indirect associations with localized demand, but rank lower in model importance than historical patterns. These are simulated observational overlays and do not establish strict causality.
          </p>
        </div>
      </div>
    </div>
  )
}

function ContextComparison({ icon, title, data, labels }: any) {
  if (!data.yes_n && !data.no_n) return null
  const max = Math.max(data.yes, data.no) || 1
  
  return (
    <div>
      <div className="flex items-center space-x-2 mb-3">
        <div className="text-[var(--color-ink-secondary)]">{icon}</div>
        <h4 className="text-[12px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider">{title}</h4>
      </div>
      <div className="space-y-2">
        <div className="flex items-center text-[12px]">
          <div className="w-[110px] text-[var(--color-ink-secondary)] truncate">{labels[0]}</div>
          <div className="flex-1 flex items-center h-4">
            <div className="h-full rounded-sm bg-[rgba(20,19,15,0.06)] transition-all" style={{ width: `${Math.max((data.no/max)*100, 2)}%` }} />
            <span className="ml-2 font-medium tabular-nums">{Math.round(data.no).toLocaleString('en-IN')}</span>
          </div>
        </div>
        <div className="flex items-center text-[12px]">
          <div className="w-[110px] text-[var(--color-ink-secondary)] truncate">{labels[1]}</div>
          <div className="flex-1 flex items-center h-4">
            <div className="h-full rounded-sm bg-[rgba(20,19,15,0.15)] transition-all" style={{ width: `${Math.max((data.yes/max)*100, 2)}%` }} />
            <span className="ml-2 font-medium tabular-nums">{Math.round(data.yes).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
