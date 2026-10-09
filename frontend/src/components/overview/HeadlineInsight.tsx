import type { ForecastSummary } from '../../lib/types'
import { generateHeadline, generateCategoryNote, generateActionLine } from '../../lib/computations'
import { TrendingUp } from 'lucide-react'

interface Props {
  summary: ForecastSummary[]
}

export function HeadlineInsight({ summary }: Props) {
  if (!summary.length) return null

  return (
    <header className="pt-6 lg:pt-10 mb-8 max-w-[800px]">
      <div className="flex items-center space-x-2 mb-4">
        <div className="px-2.5 py-1 rounded-md bg-[var(--color-accent-subtle)] border border-[var(--color-accent)]/20 text-[var(--color-accent)] text-[11px] font-bold uppercase tracking-wider flex items-center">
          <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
          Demand Signal
        </div>
      </div>
      <h1 className="font-heading font-extrabold text-[28px] lg:text-[36px] leading-[1.2] tracking-tight text-[var(--color-text)] mb-4">
        {generateHeadline(summary)}
      </h1>
      <p className="text-[15px] lg:text-[16px] text-[var(--color-text-secondary)] leading-relaxed mb-1 font-medium">
        {generateActionLine(summary)}
      </p>
      <p className="text-[14px] text-[var(--color-text-tertiary)]">
        {generateCategoryNote(summary)}
      </p>
    </header>
  )
}