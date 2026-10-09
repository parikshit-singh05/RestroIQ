import type { ForecastSummary } from '../../lib/types'
import { generateHeadline, generateCategoryNote, generateActionLine } from '../../lib/computations'
// // import { formatCompact } from '../../lib/format'

interface Props {
  summary: ForecastSummary[]
}

export function HeadlineInsight({ summary }: Props) {
  if (!summary.length) return null

  const headline = generateHeadline(summary)
  const categoryNote = generateCategoryNote(summary)
  const actionLine = generateActionLine(summary)

  return (
    <section className="mb-10 max-w-[760px]" aria-label="Forecast headline insight">
      <h1 className="font-serif text-[28px] leading-[1.25] tracking-tight text-[var(--color-ink)] mb-1.5">
        {headline}
      </h1>
      <p className="text-[15px] text-[var(--color-ink-secondary)] mb-4">{categoryNote}</p>
      <p className="text-[14px] text-[var(--color-ink-secondary)] border-l-2 border-[var(--color-brand)] pl-4">
        <span className="font-semibold text-[var(--color-ink)]">What to do: </span>
        {actionLine}
      </p>
    </section>
  )
}