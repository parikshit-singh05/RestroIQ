import { useMemo } from 'react'

export function AnalyticsRead({ dist, promo }: { dist: any, promo: any }) {
  const read = useMemo(() => {
    if (!dist.category || !dist.category.length) return { headline: '', points: [] }
    
    const topCat = dist.category[0]
    const topCui = dist.cuisine[0]
    const topCent = dist.center[0]
    
    const catTotal = dist.total_demand || dist.category.reduce((s: number, d: any) => s + d.value, 0)
    const catPct = ((topCat.value / catTotal) * 100).toFixed(0)
    
    const diff = promo.emailer.no ? ((promo.emailer.yes - promo.emailer.no) / promo.emailer.no) * 100 : 0
    
    let headline = ''
    if (diff > 15) {
      headline = `Promoted items show noticeably higher observed demand, while ${topCat.name} drives the baseline.`
    } else {
      headline = `Demand is highly concentrated across ${topCat.name} and ${topCui.name} cuisines.`
    }

    const points = [
      `${topCat.name} represents ${catPct}% of all observed demand in this view (${dist.total_demand.toLocaleString('en-IN')} total orders).`,
      `Center ${topCent.name} records the highest volume for the selected parameters.`,
      `Historical demand patterns remain the strongest signal for prediction, followed by promotional factors.`
    ]
    
    if (diff > 5) {
      points.splice(1, 0, `Emailer promotions are observed alongside a ${diff.toFixed(1)}% higher average demand compared to baseline.`)
    }

    return { headline, points }
  }, [dist, promo])

  if (!read.headline) return null

  return (
    <div className="mb-10 max-w-[800px]" aria-label="Analytical Read">
      <h2 className="font-serif text-[28px] leading-[1.25] tracking-tight text-[var(--color-ink)] mb-4">
        {read.headline}
      </h2>
      <div className="bg-[rgba(20,19,15,0.02)] border border-[var(--color-hairline)] rounded-lg p-5">
        <h4 className="text-[11px] font-semibold text-[var(--color-ink-secondary)] uppercase tracking-wider mb-3">
          Analytical Read
        </h4>
        <ul className="space-y-2">
          {read.points.map((pt, i) => (
            <li key={i} className="flex items-start space-x-3 text-[14px] text-[var(--color-ink)] leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] mt-[8px] flex-shrink-0" />
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
