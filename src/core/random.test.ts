import { describe, expect, it } from 'vitest'
import { inDisc, pickWeighted, seededRandom } from './random'

describe('seededRandom', () => {
  it('repeats for a seed and stays in [0, 1)', () => {
    const a = seededRandom(99)
    const b = seededRandom(99)
    for (let index = 0; index < 1000; index++) {
      const value = a()
      expect(value).toBe(b())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('pickWeighted', () => {
  it('never picks an entry of weight 0', () => {
    const random = seededRandom(1)
    for (let index = 0; index < 500; index++) {
      expect(
        pickWeighted(random, [
          ['a', 0],
          ['b', 1],
          ['c', 0],
        ]),
      ).toBe('b')
    }
  })

  it('picks by weight', () => {
    const random = seededRandom(2)
    let heavy = 0
    for (let index = 0; index < 4000; index++)
      if (
        pickWeighted(random, [
          ['light', 1],
          ['heavy', 3],
        ]) === 'heavy'
      )
        heavy++
    expect(heavy / 4000).toBeCloseTo(0.75, 1)
  })

  it('refuses entries without weight', () => {
    expect(() => pickWeighted(seededRandom(1), [['a', 0]])).toThrow()
  })
})

describe('inDisc', () => {
  it('stays inside the disc', () => {
    const random = seededRandom(5)
    for (let index = 0; index < 500; index++) {
      const { x, y } = inDisc(random, 3)
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(3)
    }
  })
})
