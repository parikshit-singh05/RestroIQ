import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  computePeakWeek,
  computeLargestWoWChange,
  computeTotalForecast,
  computeAverageForecast,
  computePreparation,
  computeSurplus,
  generateHeadline,
  generateCategoryNote,
  generateActionLine,
  generateObservations,
  getDistinct
} from './computations.ts'
import type { ForecastSummary } from './types.ts'

const mockSummary: ForecastSummary[] = [
  { week: 146, total_predicted_orders: 1000, average_predicted_orders: 100, highest_demand_category: 'Beverages', highest_demand_city: 'Pune' },
  { week: 147, total_predicted_orders: 1500, average_predicted_orders: 150, highest_demand_category: 'Beverages', highest_demand_city: 'Pune' },
  { week: 148, total_predicted_orders: 1200, average_predicted_orders: 120, highest_demand_category: 'Rice Bowl', highest_demand_city: 'Mumbai' },
  { week: 149, total_predicted_orders: 800,  average_predicted_orders: 80,  highest_demand_category: 'Sandwich',  highest_demand_city: 'Delhi' },
]

describe('RestroIQ Frontend Mathematical & Analytical Computations', () => {
  test('computePeakWeek correctly identifies peak week and baseline delta', () => {
    const peak = computePeakWeek(mockSummary)
    assert.equal(peak.week, 147)
    assert.equal(peak.value, 1500)
    assert.equal(peak.category, 'Beverages')
    assert.equal(peak.city, 'Pune')
    // Baseline is 1000, peak is 1500 -> +50% above baseline
    assert.equal(peak.pctAboveBaseline, 50)
  })

  test('computeLargestWoWChange captures maximum shift and direction', () => {
    const wow = computeLargestWoWChange(mockSummary)
    // 1000 -> 1500 is +500. 1500 -> 1200 is -300. 1200 -> 800 is -400.
    // Largest delta is +500 between 146 and 147
    assert.equal(wow.fromWeek, 146)
    assert.equal(wow.toWeek, 147)
    assert.equal(wow.delta, 500)
    assert.equal(wow.pctChange, 50)
  })

  test('computeTotalForecast and computeAverageForecast aggregate correctly', () => {
    const total = computeTotalForecast(mockSummary)
    assert.equal(total, 4500) // 1000 + 1500 + 1200 + 800
    const avg = computeAverageForecast(mockSummary)
    assert.equal(avg, 1125) // 4500 / 4
  })

  test('computePreparation applies buffer exactly once without compounding', () => {
    const total = 10000
    assert.equal(computePreparation(total, 0), 10000)
    assert.equal(computePreparation(total, 10), 11000)
    assert.equal(computePreparation(total, 15), 11500)
    assert.equal(computePreparation(total, 20), 12000)
  })

  test('computeSurplus strictly calculates margin above baseline', () => {
    const total = 10000
    assert.equal(computeSurplus(total, 0), 0)
    assert.equal(computeSurplus(total, 10), 1000)
    assert.equal(computeSurplus(total, 15), 1500)
    assert.equal(computeSurplus(total, 20), 2000)
  })

  test('generateHeadline formats informative narrative', () => {
    const headline = generateHeadline(mockSummary)
    assert.match(headline, /Demand peaks in Week 147/)
    assert.match(headline, /50% above/)
  })

  test('generateCategoryNote and generateActionLine reflect peak drivers', () => {
    const note = generateCategoryNote(mockSummary)
    assert.match(note, /Beverages drives the highest/)
    const action = generateActionLine(mockSummary)
    assert.match(action, /prioritizing Beverages at Pune/)
  })

  test('generateObservations reconciles with buffer options', () => {
    const obs0 = generateObservations(mockSummary, 4500, 0)
    assert.ok(obs0.some(o => o.includes('strictly matches the baseline forecast')))

    const obs10 = generateObservations(mockSummary, 4500, 10)
    assert.ok(obs10.some(o => o.includes('10% safety margin')))
    assert.ok(obs10.some(o => o.includes('buffer volume of 450 uncommitted orders')))
  })

  test('getDistinct extracts and sorts unique values correctly', () => {
    const items = [
      { city: 'Pune' },
      { city: 'Mumbai' },
      { city: 'Pune' },
      { city: 'Delhi' }
    ]
    const distinct = getDistinct(items, 'city')
    assert.deepEqual(distinct, ['Delhi', 'Mumbai', 'Pune'])
  })
})
