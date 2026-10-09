import { Info } from 'lucide-react'

export function SecondaryContext() {
  return (
    <section className="mt-10 pt-8 pb-12 border-t border-[var(--color-hairline)]" aria-label="Secondary context">
      <div className="grid grid-cols-2 gap-8 mb-6">
        {/* Contextual Signals */}
        <div>
          <h3 className="text-[12px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider mb-3">
            Contextual signals
          </h3>
          <p className="text-[13px] text-[var(--color-ink-secondary)] leading-relaxed mb-3">
            Historical baseline demand and geographic footprint drive the majority of predicted volume. Email promotions and homepage features are included as secondary weighting factors.
          </p>
          <div className="flex items-start space-x-2 bg-[rgba(20,19,15,0.03)] rounded-md p-3 border border-[var(--color-hairline)]">
            <Info className="w-3.5 h-3.5 text-[var(--color-ink-secondary)] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-[var(--color-ink-secondary)] leading-snug">
              Simulated weather and simulated calendar events are observational indicators only. The model establishes statistical correlation for volume estimation, not causal relationships.
            </p>
          </div>
        </div>

        {/* Model Performance */}
        <div>
          <h3 className="text-[12px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider mb-3">
            Validation performance
          </h3>
          <div className="flex items-baseline space-x-2 mb-2">
            <span className="text-2xl font-serif text-[var(--color-ink)] tabular-nums">0.5331</span>
            <span className="text-[12px] font-medium text-[var(--color-ink-secondary)]">RMSLE</span>
          </div>
          <p className="text-[13px] text-[var(--color-ink-secondary)] leading-relaxed">
            Finalized Random Forest (log1p target) model. Evaluated using strict recursive walk-forward validation across Weeks 136â€“145.
          </p>
        </div>
      </div>
      
      {/* Grounding footer line to prevent cut-off feeling */}
      <div className="w-full flex justify-center mt-12">
        <div className="w-8 h-1 rounded-full bg-[rgba(20,19,15,0.08)]"></div>
      </div>
    </section>
  )
}