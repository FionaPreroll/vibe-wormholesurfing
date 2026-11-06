import { clamp01, lerp } from './math'
import { pickWeighted, type Random } from './random'

/** The colors of warp holes. Each color leads to a world of its own kind. */
export const HOLE_COLORS = ['red', 'blue', 'green', 'yellow', 'white'] as const
export type HoleColor = (typeof HOLE_COLORS)[number]

/**
 * How rare a warp hole is: 1 is a plain hole, 2 has a halo, 3 two halos, and 4 two halos and a
 * flower-shaped aura. Rarer holes hold rarer rewards.
 */
export type HoleTier = 1 | 2 | 3 | 4
export const HOLE_TIERS: readonly HoleTier[] = [1, 2, 3, 4]

/** Light-years after which the odds of holes and rewards stop getting better. */
export const DISTANCE_CAP = 5000

/** Chances of each tier at some distances; between them they blend smoothly. */
const TIER_TABLE: readonly (readonly [number, readonly [number, number, number, number]])[] = [
  [0, [86, 12, 2, 0]],
  [800, [70, 22, 7, 1]],
  [2000, [48, 30, 16, 6]],
  [3500, [30, 32, 24, 14]],
  [DISTANCE_CAP, [16, 30, 30, 24]],
]

/** The weight of each tier, from tier 1 to 4, at a distance in light-years. */
export function tierWeights(distance: number): [number, number, number, number] {
  const d = Math.max(0, distance)
  for (let index = 1; index < TIER_TABLE.length; index++) {
    const [to, high] = TIER_TABLE[index] as (typeof TIER_TABLE)[number]
    const [from, low] = TIER_TABLE[index - 1] as (typeof TIER_TABLE)[number]
    if (d <= to) {
      const amount = clamp01((d - from) / (to - from))
      return [0, 1, 2, 3].map((tier) => lerp(low[tier] ?? 0, high[tier] ?? 0, amount)) as [
        number,
        number,
        number,
        number,
      ]
    }
  }
  return [...(TIER_TABLE.at(-1) as (typeof TIER_TABLE)[number])[1]] as [
    number,
    number,
    number,
    number,
  ]
}

/** Colored holes are all alike; white ones, which lead to the strangest worlds, are rarer. */
const COLOR_WEIGHTS: readonly (readonly [HoleColor, number])[] = [
  ['red', 21],
  ['blue', 21],
  ['green', 21],
  ['yellow', 21],
  ['white', 16],
]

export interface HoleKind {
  readonly color: HoleColor
  readonly tier: HoleTier
}

/** The color and tier of a new hole at a distance. */
export function rollHole(random: Random, distance: number): HoleKind {
  const weights = tierWeights(distance)
  const tier = pickWeighted(
    random,
    HOLE_TIERS.map((value, index) => [value, weights[index] ?? 0] as const),
  )
  const color = pickWeighted(random, COLOR_WEIGHTS)
  return { color, tier }
}
