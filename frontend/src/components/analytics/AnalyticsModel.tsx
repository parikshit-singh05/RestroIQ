import { BrainCircuit, Activity } from 'lucide-react'

export function AnalyticsModel({ model }: { model: any[] }) {
  const features = (model || []).slice(0, 7)
  const maxImp = Math.max(...features.map((f: any) => f.imp))
  
  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-surface-alt)] p-6 shadow-sm flex flex-col h-full" aria-label="Model Signal">
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center space-x-2">
          <BrainCircuit className="w-4 h-4 text-[var(--color-accent)]" />
          <h3 className="text-[16px] font-heading font-bold tracking-tight text-[var(--color-text)]">Model Feature Importance</h3>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-0.5">Algorithm</div>
          <div className="text-[12px] font-bold text-[var(--color-text)]">Random Forest</div>
        </div>
      </div>
      
      <div className="space-y-4 mb-6">
        {features.map(f => (
          <div key={f.name} className="relative group">
            <div className="flex justify-between text-[12px] mb-1.5">
              <span className="font-bold text-[var(--color-text)] uppercase tracking-wide">{f.name}</span>
              <span className="font-bold tabular-nums text-[var(--color-text-secondary)]">{(f.imp*100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-text-secondary)] opacity-60 group-hover:bg-[var(--color-accent)] group-hover:opacity-100 rounded-full transition-all duration-300" style={{ width: `${(f.imp/maxImp)*100}%` }} />
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-auto pt-4 border-t border-[var(--color-border-subtle)] flex items-start space-x-2.5">
        <Activity className="w-4 h-4 text-[var(--color-text-tertiary)] mt-0.5 flex-shrink-0" />
        <p className="text-[11px] font-medium text-[var(--color-text-secondary)] leading-relaxed">
          Feature importance indicates how useful a variable was during recursive walk-forward validation (Weeks 136–145); it does not establish causation.
        </p>
      </div>
    </div>
  )
}