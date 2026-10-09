import { Activity, BrainCircuit } from 'lucide-react'

export function AnalyticsModel({ model }: { model: any[] }) {
  const features = (model || []).slice(0, 7) // Show top 7
  const maxImp = Math.max(...features.map((f: any) => f.imp))
  
  return (
    <div className="border border-[var(--color-hairline)] rounded-lg bg-[rgba(20,19,15,0.015)] p-6 mb-8 flex-1" aria-label="Model Signal">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <BrainCircuit className="w-4 h-4 text-[var(--color-brand)]" />
            <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">Model Signal</h3>
          </div>
          <p className="text-[13px] text-[var(--color-ink-secondary)]">
            Relative importance of variables used by the forecasting model.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider mb-0.5">Algorithm</div>
          <div className="text-[13px] font-medium text-[var(--color-ink)]">Random Forest <span className="text-[11px] text-[var(--color-ink-secondary)]">(log1p target)</span></div>
        </div>
      </div>
      
      <div className="space-y-3 mb-6">
        {features.map(f => (
          <div key={f.name} className="relative">
            <div className="flex justify-between text-[12px] mb-1">
              <span className="font-medium text-[var(--color-ink)]">{f.name}</span>
              <span className="tabular-nums text-[var(--color-ink-secondary)]">{(f.imp*100).toFixed(0)}%</span>
            </div>
            <div className="h-1 w-full bg-[rgba(20,19,15,0.04)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-ink)] opacity-60 rounded-full" style={{ width: `${(f.imp/maxImp)*100}%` }} />
            </div>
          </div>
        ))}
      </div>
      
      <div className="pt-4 border-t border-[rgba(20,19,15,0.06)] flex items-start space-x-2">
        <Activity className="w-3.5 h-3.5 text-[var(--color-ink-secondary)] mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-[var(--color-ink-secondary)] leading-relaxed">
          Feature importance indicates how useful a variable was to the fitted model during recursive walk-forward validation (Weeks 136–145, RMSLE 0.5331); it does not establish causation.
        </p>
      </div>
    </div>
  )
}
