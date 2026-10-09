import { Info, Target } from 'lucide-react'

export function SecondaryContext() {
  return (
    <section className="mt-12 pt-10 pb-8 border-t border-[var(--color-border-subtle)]" aria-label="Secondary context">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Info className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            <h3 className="text-[12px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Contextual Signals
            </h3>
          </div>
          <p className="text-[13px] font-medium text-[var(--color-text-secondary)] leading-relaxed mb-4">
            Historical baseline demand and geographic footprint drive the majority of predicted volume. Email promotions and homepage features are included as secondary weighting factors.
          </p>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 shadow-sm">
            <p className="text-[12px] font-medium text-[var(--color-text-tertiary)] leading-snug">
              Simulated weather and simulated calendar events are observational indicators only. The model establishes statistical correlation for volume estimation, not causal relationships.
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Target className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            <h3 className="text-[12px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Validation Performance
            </h3>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-5 shadow-sm">
            <div className="flex items-baseline space-x-2 mb-2">
              <span className="text-3xl font-heading font-extrabold text-[var(--color-text)] tabular-nums">0.5331</span>
              <span className="text-[12px] font-bold text-[var(--color-text-tertiary)] uppercase">RMSLE</span>
            </div>
            <p className="text-[13px] font-medium text-[var(--color-text-secondary)] leading-relaxed">
              Finalized Random Forest (log1p target) model. Evaluated using strict recursive walk-forward validation across Weeks 136 – 145.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}