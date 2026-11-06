import { describe, expect, it } from 'vitest'
import { seededRandom } from './random'
import { isStrange, isWorldId, worldOf } from './worlds'

describe('worldOf', () => {
  it('leads colored holes to their own world', () => {
    const random = seededRandom(1)
    expect(worldOf(random, 'red', 1)).toBe('cliffs')
    expect(worldOf(random, 'blue', 4)).toBe('lagoon')
    expect(worldOf(random, 'green', 2)).toBe('canyon')
    expect(worldOf(random, 'yellow', 3)).toBe('caverns')
  })

  it('leads white holes to strange worlds, rare ones more often in rare holes', () => {
    const count = (tier: 1 | 4) => {
      const random = seededRandom(2)
      let void_ = 0
      for (let index = 0; index < 2000; index++) {
        const world = worldOf(random, 'white', tier)
        expect(isStrange(world)).toBe(true)
        if (world === 'auroraVoid') void_++
      }
      return void_
    }
    expect(count(4)).toBeGreaterThan(count(1) * 5)
  })

  it('knows its world ids', () => {
    expect(isWorldId('starDunes')).toBe(true)
    expect(isWorldId('moon')).toBe(false)
  })
})
