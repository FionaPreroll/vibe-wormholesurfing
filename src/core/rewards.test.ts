import { describe, expect, it } from 'vitest'
import { DISTANCE_CAP } from './holes'
import { seededRandom } from './random'
import {
  checkItems,
  ITEMS,
  itemById,
  RARITIES,
  rarityWeights,
  rollReward,
  shinyChance,
} from './rewards'

describe('items', () => {
  it('gives each world one treasure of each rarity, with unique ids', () => {
    expect(checkItems()).toBe(true)
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(ITEMS.length)
    expect(itemById('fallenStar')?.rarity).toBe('legendary')
  })
})

describe('rollReward', () => {
  it('always gives the legendary treasure in a flower-aura hole until it is found', () => {
    const random = seededRandom(3)
    for (let index = 0; index < 50; index++) {
      const reward = rollReward(random, {
        world: 'lagoon',
        tier: 4,
        distance: 0,
        found: new Set(),
      })
      expect(reward.item.id).toBe('deepHeart')
    }
    const after = new Set<string>()
    for (let index = 0; index < 300; index++) {
      after.add(
        rollReward(random, { world: 'lagoon', tier: 4, distance: 0, found: new Set(['deepHeart']) })
          .item.rarity,
      )
    }
    expect(after.size).toBeGreaterThan(2)
  })

  it('finds rarer treasures in rarer holes and farther out', () => {
    const average = (tier: 1 | 2 | 3, distance: number) => {
      const random = seededRandom(17)
      let sum = 0
      for (let index = 0; index < 3000; index++) {
        const { item } = rollReward(random, { world: 'canyon', tier, distance, found: new Set() })
        sum += RARITIES.indexOf(item.rarity)
      }
      return sum / 3000
    }
    expect(average(3, 0)).toBeGreaterThan(average(1, 0))
    expect(average(1, DISTANCE_CAP)).toBeGreaterThan(average(1, 0))
  })

  it('never finds a legendary treasure in a plain hole close to home', () => {
    expect(rarityWeights(1, 0)[4]).toBe(0)
  })

  it('makes shiny treasures likelier with distance', () => {
    expect(shinyChance(DISTANCE_CAP)).toBeGreaterThan(shinyChance(0))
    expect(shinyChance(DISTANCE_CAP * 4)).toBe(shinyChance(DISTANCE_CAP))
  })
})
