import { useAppContext } from '../../context/AppContext'
import { formatCompact } from '../../lib/format'

interface Props {
  totalForecast: number
}

export function InventoryScenarios({ totalForecast }: Props) {
  const { buffer, setBuffer } = useAppContext()

  const scenarios = [
    { label: '0%', val: 0 },
    { label: '10%', val: 10 },
    { label: '15%', val: 15 },
    { label: '20%', val: 20 },
  ]

  return (
    <section className="mb-10" aria-label="Buffer scenarios">
      <h3 className="text-[13px] font-semibold tracking-tight mb-4 text-[var(--color-ink-secondary)] uppercase">
        Preparation Scenarios
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {scenarios.map(s => {
          const isActive = buffer === s.val
          const prep = totalForecast * (1 + s.val / 100)
          const extra = prep - totalForecast

          return (
            <button
              key={s.val}
              onClick={() => setBuffer(s.val as any)}
              className={`text-left p-5 rounded-lg border transition-all ${
                isActive 
                  ? 'border-[var(--color-brand)] bg-[rgba(224,73,43,0.03)] shadow-sm' 
                  : 'border-[var(--color-hairline)] bg-[var(--color-surface)] hover:border-[rgba(20,19,15,0.2)]'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`text-[15px] font-semibold ${isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink)]'}`}>
                  {s.label} Buffer
                </span>
                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]"></span>
                )}
              </div>
              <div className="mb-2">
                <div className="text-[11px] text-[var(--color-ink-secondary)] uppercase tracking-wider mb-0.5">Prepared</div>
                <div className="text-[18px] font-semibold tabular-nums text-[var(--color-ink)]">{formatCompact(prep)}</div>
              </div>
              <div className="pt-2 border-t border-[rgba(20,19,15,0.06)] mt-2">
                <div className="text-[11px] text-[var(--color-ink-secondary)] uppercase tracking-wider mb-0.5">Additional Buffer</div>
                <div className={`text-[13px] font-medium tabular-nums ${isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink-secondary)]'}`}>
                  {s.val === 0 ? '—' : `+${formatCompact(extra)}`}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}



