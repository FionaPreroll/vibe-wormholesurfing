import type { HoleColor, HoleTier } from './holes'
import { pickWeighted, type Random } from './random'

/** The worlds a warp hole can lead to. */
export const WORLD_IDS = [
  'cliffs',
  'lagoon',
  'canyon',
  'caverns',
  'crystalSea',
  'starDunes',
  'floatingGardens',
  'auroraVoid',
] as const
export type WorldId = (typeof WORLD_IDS)[number]

/** The world behind each colored hole. White holes lead to one of the strange worlds. */
const COLORED: Readonly<Record<Exclude<HoleColor, 'white'>, WorldId>> = {
  red: 'cliffs',
  blue: 'lagoon',
  green: 'canyon',
  yellow: 'caverns',
}

/** The strange worlds behind white holes, by tier: rare ones open up in rarer holes. */
const STRANGE: Readonly<Record<HoleTier, readonly (readonly [WorldId, number])[]>> = {
  1: [
    ['crystalSea', 45],
    ['starDunes', 45],
    ['floatingGardens', 9],
    ['auroraVoid', 1],
  ],
  2: [
    ['crystalSea', 36],
    ['starDunes', 36],
    ['floatingGardens', 22],
    ['auroraVoid', 6],
  ],
  3: [
    ['crystalSea', 26],
    ['starDunes', 26],
    ['floatingGardens', 32],
    ['auroraVoid', 16],
  ],
  4: [
    ['crystalSea', 18],
    ['starDunes', 18],
    ['floatingGardens', 34],
    ['auroraVoid', 30],
  ],
}

/** The world a hole of this color and tier opens into. */
export function worldOf(random: Random, color: HoleColor, tier: HoleTier): WorldId {
  return color === 'white' ? pickWeighted(random, STRANGE[tier]) : COLORED[color]
}

/** Whether a world lies behind white holes only. */
export function isStrange(world: WorldId): boolean {
  return !Object.values(COLORED).includes(world)
}

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === 'string' && (WORLD_IDS as readonly string[]).includes(value)
}
