import test, { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('RestroIQ Phase 4 — SaaS Operations & Platform Intelligence Computations', () => {
  it('kitchen preparation targets strictly satisfy mathematical non-decreasing invariants', () => {
    const testCases = [
      { predicted: 0, expected: [0, 0, 0, 0] },
      { predicted: 10, expected: [10, 11, 12, 12] },
      { predicted: 35.4, expected: [35, 39, 41, 42] },
      { predicted: 100, expected: [100, 110, 115, 120] },
      { predicted: 142.8, expected: [143, 157, 164, 171] }
    ]

    for (const { predicted, expected } of testCases) {
      const p0 = Math.round(predicted)
      const p10 = Math.round(predicted * 1.10)
      const p15 = Math.round(predicted * 1.15)
      const p20 = Math.round(predicted * 1.20)

      assert.deepEqual([p0, p10, p15, p20], expected)
      // Monotonicity check
      assert.ok(p0 <= p10, `p0 (${p0}) must be <= p10 (${p10})`)
      assert.ok(p10 <= p15, `p10 (${p10}) must be <= p15 (${p15})`)
      assert.ok(p15 <= p20, `p15 (${p15}) must be <= p20 (${p20})`)
    }
  })

  it('average order value (AOV) strictly computed from order sales without denominator inflation', () => {
    const calculateAOV = (totalRevenue: number, totalOrders: number): number => {
      if (totalOrders <= 0) return 0.0
      return Math.round((totalRevenue / totalOrders) * 100) / 100
    }

    assert.equal(calculateAOV(0, 0), 0.0)
    assert.equal(calculateAOV(15000, 30), 500.0)
    assert.equal(calculateAOV(25430.50, 47), 541.07)
  })

  it('menu item velocity tiers correctly classify volume thresholds', () => {
    const classifyVelocity = (weeklyUnits: number): 'high' | 'steady' | 'slow' => {
      if (weeklyUnits >= 50) return 'high'
      if (weeklyUnits >= 15) return 'steady'
      return 'slow'
    }

    assert.equal(classifyVelocity(120), 'high')
    assert.equal(classifyVelocity(50), 'high')
    assert.equal(classifyVelocity(49), 'steady')
    assert.equal(classifyVelocity(15), 'steady')
    assert.equal(classifyVelocity(14), 'slow')
    assert.equal(classifyVelocity(0), 'slow')
  })

  it('operating days parser preserves case-insensitive days and handles comma separation', () => {
    const parseOperatingDays = (daysStr: string): string[] => {
      if (!daysStr) return []
      return daysStr
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    }

    assert.deepEqual(
      parseOperatingDays('mon,tue,wed,thu,fri,sat,sun'),
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    )
    assert.deepEqual(
      parseOperatingDays('Mon, Wed, Fri'),
      ['mon', 'wed', 'fri']
    )
    assert.deepEqual(parseOperatingDays(''), [])
  })

  it('sole owner guard correctly flags non-removable members', () => {
    const members = [
      { id: '1', role: 'owner' },
      { id: '2', role: 'admin' },
      { id: '3', role: 'analyst' }
    ]

    const isSoleOwner = (memberId: string, list: typeof members): boolean => {
      const target = list.find(m => m.id === memberId)
      if (!target || target.role !== 'owner') return false
      return list.filter(m => m.role === 'owner').length <= 1
    }

    assert.equal(isSoleOwner('1', members), true)  // Sole owner
    assert.equal(isSoleOwner('2', members), false) // Admin
    assert.equal(isSoleOwner('3', members), false) // Analyst

    // With multiple owners
    const multiOwnerMembers = [
      { id: '1', role: 'owner' },
      { id: '4', role: 'owner' },
      { id: '2', role: 'admin' }
    ]
    assert.equal(isSoleOwner('1', multiOwnerMembers), false) // Can remove because another owner exists
  })
})

