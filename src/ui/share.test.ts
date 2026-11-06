import { describe, expect, it } from 'vitest'
import { RARITIES } from '../core/rewards'
import { WORLD_IDS } from '../core/worlds'
import { PICTURE, pictureGrid } from './share'

describe('the collection picture', () => {
  it('keeps the grid the same distance from the top, the bottom and the right edge', () => {
    const grid = pictureGrid(WORLD_IDS.length, RARITIES.length)
    const right = PICTURE.width - (grid.left + RARITIES.length * (grid.cell + grid.gap) - grid.gap)
    const bottom =
      PICTURE.height - (grid.top + WORLD_IDS.length * (grid.cell + grid.gap) - grid.gap)
    expect(grid.top).toBe(grid.margin)
    expect(right).toBe(grid.margin)
    expect(Math.abs(bottom - grid.margin)).toBeLessThanOrEqual(1)
    expect(grid.margin).toBeGreaterThanOrEqual(PICTURE.margin)
    // Room on the left for the title, the numbers and the world names.
    expect(grid.left).toBeGreaterThan(780)
  })
})
