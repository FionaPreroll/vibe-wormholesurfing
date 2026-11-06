import { describe, expect, it } from 'vitest'
import { DISTANCE_CAP, rollHole, tierWeights } from './holes'
import { seededRandom } from './random'

describe('tierWeights', () => {
  it('makes rare tiers likelier with distance, up to the cap', () => {
    const near = tierWeights(0)
    const far = tierWeights(DISTANCE_CAP)
    expect(near[3]).toBe(0)
    expect(far[3]).toBeGreaterThan(near[2])
    expect(far[0]).toBeLessThan(near[0])
    expect(tierWeights(DISTANCE_CAP * 3)).toEqual(far)
  })

  it('blends smoothly between the table rows', () => {
    const [a] = tierWeights(1000)
    const [b] = tierWeights(1100)
    expect(a).toBeGreaterThan(b)
    expect(a - b).toBeLessThan(5)
  })
})

describe('rollHole', () => {
  it('rolls every color and tier at the cap', () => {
    const random = seededRandom(7)
    const seen = new Set<string>()
    for (let index = 0; index < 2000; index++) {
      const hole = rollHole(random, DISTANCE_CAP)
      seen.add(hole.color)
      seen.add(`tier${hole.tier}`)
    }
    expect(seen).toEqual(
      new Set(['red', 'blue', 'green', 'yellow', 'white', 'tier1', 'tier2', 'tier3', 'tier4']),
    )
  })
})
