import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('RestroIQ Phase 3 — Forecasting Engine Frontend Computations', () => {
  test('preparation buffer calculations strictly satisfy non-decreasing mathematical invariants', () => {
    const testCases = [0, 0.2, 1.0, 7.3, 14.8, 25.0, 99.1, 145.4, 1000.0]

    for (const pred of testCases) {
      const p0 = Math.ceil(pred)
      const p10 = Math.ceil(Math.round(pred * 1.10 * 10000) / 10000)
      const p15 = Math.ceil(Math.round(pred * 1.15 * 10000) / 10000)
      const p20 = Math.ceil(Math.round(pred * 1.20 * 10000) / 10000)

      assert.ok(p0 >= pred, `p0 (${p0}) must be >= pred (${pred})`)
      assert.ok(p10 >= p0, `p10 (${p10}) must be >= p0 (${p0}) for pred ${pred}`)
      assert.ok(p15 >= p10, `p15 (${p15}) must be >= p10 (${p10}) for pred ${pred}`)
      assert.ok(p20 >= p15, `p20 (${p20}) must be >= p15 (${p15}) for pred ${pred}`)
    }
  })

  test('frequency and horizon defaults are correctly matched', () => {
    const resolveDefaultHorizon = (freq: 'daily' | 'weekly') => freq === 'daily' ? 14 : 4
    assert.equal(resolveDefaultHorizon('daily'), 14)
    assert.equal(resolveDefaultHorizon('weekly'), 4)
  })

  test('WAPE metric percentage format handles zero and typical ranges', () => {
    const formatWape = (wape: number | null | undefined) => {
      if (wape === null || wape === undefined) return 'N/A'
      return `${(wape * 100).toFixed(1)}%`
    }

    assert.equal(formatWape(0.0), '0.0%')
    assert.equal(formatWape(0.0842), '8.4%')
    assert.equal(formatWape(0.1589), '15.9%')
    assert.equal(formatWape(null), 'N/A')
  })

  test('model labels map cleanly to user-friendly titles', () => {
    const formatModelLabel = (model: string) => {
      switch (model) {
        case 'ml_random_forest':
          return 'Random Forest Regressor'
        case 'ml_gradient_boosting':
          return 'Gradient Boosting (HistGB)'
        case 'ml_ridge_regression':
          return 'Ridge Regression (L2 Regularized)'
        case 'baseline_seasonal_naive':
          return 'Seasonal Naïve (Day-of-Week)'
        case 'baseline_moving_average':
          return 'Moving Average'
        default:
          return model.replace(/_/g, ' ')
      }
    }

    assert.equal(formatModelLabel('ml_random_forest'), 'Random Forest Regressor')
    assert.equal(formatModelLabel('ml_gradient_boosting'), 'Gradient Boosting (HistGB)')
    assert.equal(formatModelLabel('baseline_seasonal_naive'), 'Seasonal Naïve (Day-of-Week)')
  })
})

