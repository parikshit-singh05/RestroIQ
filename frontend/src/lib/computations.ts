import type { ForecastSummary } from './types'
import { formatCompact, formatPctChange } from './format'

export interface PeakWeekInfo {
  week: number
  value: number
  pctAboveBaseline: number
  category: string
  city: string
}

export interface WoWChange {
  fromWeek: number
  toWeek: number
  delta: number
  pctChange: number
}

export function computePeakWeek(summary: ForecastSummary[]): PeakWeekInfo {
  if (!summary.length) return { week: 0, value: 0, pctAboveBaseline: 0, category: '', city: '' }
  const baseline = summary[0].total_predicted_orders
  const peak = summary.reduce((max, s) =>
    s.total_predicted_orders > max.total_predicted_orders ? s : max, summary[0])
  const pctAboveBaseline = ((peak.total_predicted_orders - baseline) / baseline) * 100
  return {
    week: peak.week,
    value: peak.total_predicted_orders,
    pctAboveBaseline,
    category: peak.highest_demand_category,
    city: peak.highest_demand_city,
  }
}

export function computeLargestWoWChange(summary: ForecastSummary[]): WoWChange {
  let maxChange: WoWChange = { fromWeek: 0, toWeek: 0, delta: 0, pctChange: 0 }
  for (let i = 1; i < summary.length; i++) {
    const prev = summary[i - 1].total_predicted_orders
    const curr = summary[i].total_predicted_orders
    const delta = curr - prev
    const absDelta = Math.abs(delta)
    if (absDelta > Math.abs(maxChange.delta)) {
      maxChange = {
        fromWeek: summary[i - 1].week,
        toWeek: summary[i].week,
        delta,
        pctChange: (delta / prev) * 100,
      }
    }
  }
  return maxChange
}

export function computeTotalForecast(summary: ForecastSummary[]): number {
  return summary.reduce((sum, s) => sum + s.total_predicted_orders, 0)
}

export function computeAverageForecast(summary: ForecastSummary[]): number {
  if (!summary.length) return 0
  return computeTotalForecast(summary) / summary.length
}

export function computePreparation(totalForecast: number, bufferPct: number): number {
  return totalForecast * (1 + bufferPct / 100)
}

export function computeSurplus(totalForecast: number, bufferPct: number): number {
  return totalForecast * (bufferPct / 100)
}

export function generateHeadline(summary: ForecastSummary[]): string {
  if (!summary.length) return ''
  const peak = computePeakWeek(summary)
  const pctStr = Math.round(Math.abs(peak.pctAboveBaseline))
  const direction = peak.pctAboveBaseline >= 0 ? 'above' : 'below'
  return `Demand peaks in Week ${peak.week} at ${formatCompact(peak.value)} orders, ${pctStr}% ${direction} the Week ${summary[0].week} baseline.`
}

export function generateCategoryNote(summary: ForecastSummary[]): string {
  if (!summary.length) return ''
  const peak = computePeakWeek(summary)
  return `${peak.category} drives the highest overall category volume at peak.`
}

export function generateActionLine(summary: ForecastSummary[]): string {
  if (!summary.length) return ''
  const peak = computePeakWeek(summary)
  return `Allocate preparation capacity to support the ${formatCompact(peak.value)} peak volume, prioritizing ${peak.category} at ${peak.city} centers.`
}

export function generateObservations(
  summary: ForecastSummary[],
  totalForecast: number,
  bufferPct: number
): string[] {
  if (!summary.length) return []
  const observations: string[] = []
  const peak = computePeakWeek(summary)
  const wow = computeLargestWoWChange(summary)
  const prep = computePreparation(totalForecast, bufferPct)
  const surplus = computeSurplus(totalForecast, bufferPct)

  observations.push(
    `Peak demand approaches in Week ${peak.week}, with ${formatCompact(peak.value)} orders expected.`
  )
  
  if (wow.delta > 0) {
    observations.push(
      `Largest weekly increase: Week ${wow.fromWeek} to ${wow.toWeek} (${formatPctChange(wow.pctChange)}, +${formatCompact(Math.abs(wow.delta))} orders).`
    )
  } else if (wow.delta < 0) {
    observations.push(
      `Largest weekly shift: Week ${wow.fromWeek} to ${wow.toWeek} (${formatPctChange(wow.pctChange)}, ${formatCompact(wow.delta)} orders).`
    )
  }

  observations.push(
    `Overall volume is concentrated in ${peak.city} facilities and the ${peak.category} category.`
  )

  if (bufferPct > 0) {
    observations.push(
      `At ${bufferPct}% safety margin, recommended preparation is ${formatCompact(prep)} orders.`
    )
    observations.push(
      `This margin allocates a buffer volume of ${formatCompact(surplus)} uncommitted orders.`
    )
  } else {
    observations.push(
      `Recommended preparation strictly matches the baseline forecast of ${formatCompact(totalForecast)} orders.`
    )
  }

  return observations
}
export function getDistinct<T>(data: T[], key: keyof T): string[] {
  const set = new Set(data.map(d => String(d[key])))
  return Array.from(set).sort()
}