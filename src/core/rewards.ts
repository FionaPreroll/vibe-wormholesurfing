import { DISTANCE_CAP, type HoleTier } from './holes'
import { clamp01, lerp } from './math'
import { pickWeighted, type Random } from './random'
import { WORLD_IDS, type WorldId } from './worlds'

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]

/** How a treasure is modeled; the view builds each shape in code. */
export const ITEM_SHAPES = [
  'pebble',
  'feather',
  'crystal',
  'egg',
  'crown',
  'shell',
  'orb',
  'flower',
  'star',
  'gem',
  'leaf',
  'mushroom',
] as const
export type ItemShape = (typeof ITEM_SHAPES)[number]

export interface Item {
  /** Also the key of its name in the message catalogs, as `item.<id>`. */
  readonly id: string
  readonly world: WorldId
  readonly rarity: Rarity
  readonly shape: ItemShape
  /** Main color as a hex number, for the model and the collection. */
  readonly color: number
}

const item = (
  id: string,
  world: WorldId,
  rarity: Rarity,
  shape: ItemShape,
  color: number,
): Item => ({ id, world, rarity, shape, color })

/** Every treasure: one of each rarity in each world. */
export const ITEMS: readonly Item[] = [
  item('emberPebble', 'cliffs', 'common', 'pebble', 0xff7a4d),
  item('windFeather', 'cliffs', 'uncommon', 'feather', 0xffd1b8),
  item('sunsetShard', 'cliffs', 'rare', 'crystal', 0xff5577),
  item('cometEgg', 'cliffs', 'epic', 'egg', 0xffa04d),
  item('highwindCrown', 'cliffs', 'legendary', 'crown', 0xffc94d),

  item('spiralShell', 'lagoon', 'common', 'shell', 0xffd8e8),
  item('tidePearl', 'lagoon', 'uncommon', 'orb', 0xcff4ff),
  item('mistLily', 'lagoon', 'rare', 'flower', 0x9fe0ff),
  item('coralStar', 'lagoon', 'epic', 'star', 0xff7aa8),
  item('deepHeart', 'lagoon', 'legendary', 'gem', 0x3d8bff),

  item('mossAgate', 'canyon', 'common', 'pebble', 0x7fbf6a),
  item('jadeLeaf', 'canyon', 'uncommon', 'leaf', 0x49d68f),
  item('echoCrystal', 'canyon', 'rare', 'crystal', 0x7dffcb),
  item('ancientSeed', 'canyon', 'epic', 'egg', 0xb6e36b),
  item('verdantCrown', 'canyon', 'legendary', 'crown', 0x3dff9e),

  item('glowMushroom', 'caverns', 'common', 'mushroom', 0xffe066),
  item('amberDrop', 'caverns', 'uncommon', 'gem', 0xffb238),
  item('geodeHeart', 'caverns', 'rare', 'orb', 0xc58bff),
  item('sunstoneCluster', 'caverns', 'epic', 'crystal', 0xffcc33),
  item('emberCoreStar', 'caverns', 'legendary', 'star', 0xff8a1f),

  item('prismSand', 'crystalSea', 'common', 'pebble', 0xe6f4ff),
  item('glassShell', 'crystalSea', 'uncommon', 'shell', 0xbfe9ff),
  item('refractionOrb', 'crystalSea', 'rare', 'orb', 0xa6c8ff),
  item('moonCrystal', 'crystalSea', 'epic', 'crystal', 0xd9e2ff),
  item('lightTear', 'crystalSea', 'legendary', 'gem', 0xffffff),

  item('stardustPebble', 'starDunes', 'common', 'pebble', 0xf0c987),
  item('meteorShard', 'starDunes', 'uncommon', 'crystal', 0xff9966),
  item('desertRose', 'starDunes', 'rare', 'flower', 0xffb3a1),
  item('cometFeather', 'starDunes', 'epic', 'feather', 0x9fd8ff),
  item('fallenStar', 'starDunes', 'legendary', 'star', 0xffe680),

  item('skyPetal', 'floatingGardens', 'common', 'flower', 0xffb8e0),
  item('cloudSeed', 'floatingGardens', 'uncommon', 'egg', 0xf2f7ff),
  item('floatLeaf', 'floatingGardens', 'rare', 'leaf', 0x8affc1),
  item('rainbowBloom', 'floatingGardens', 'epic', 'flower', 0xff8af0),
  item('gardenCrown', 'floatingGardens', 'legendary', 'crown', 0xffa8e8),

  item('voidPebble', 'auroraVoid', 'common', 'pebble', 0x6b5bff),
  item('auroraFeather', 'auroraVoid', 'uncommon', 'feather', 0x6bffd8),
  item('nebulaOrb', 'auroraVoid', 'rare', 'orb', 0xb06bff),
  item('riftCrystal', 'auroraVoid', 'epic', 'crystal', 0x5cf2ff),
  item('auroraStar', 'auroraVoid', 'legendary', 'star', 0x9dff6b),
]

const BY_ID = new Map(ITEMS.map((entry) => [entry.id, entry]))

export function itemById(id: string): Item | undefined {
  return BY_ID.get(id)
}

export function itemsOf(world: WorldId): readonly Item[] {
  return ITEMS.filter((entry) => entry.world === world)
}

/** The chances of each rarity, common to legendary, in a hole of each tier. */
const RARITY_BY_TIER: Readonly<Record<HoleTier, readonly number[]>> = {
  1: [58, 28, 11, 3, 0],
  2: [38, 33, 19, 8, 2],
  3: [20, 30, 28, 16, 6],
  4: [0, 10, 30, 35, 25],
}

/**
 * Weights of each rarity in a hole of a tier, reached at a distance. Distance shifts the odds
 * toward rarer finds, up to the cap.
 */
export function rarityWeights(tier: HoleTier, distance: number): number[] {
  const bonus = clamp01(distance / DISTANCE_CAP)
  return RARITY_BY_TIER[tier].map(
    (weight, index) =>
      // Common finds fade to half at the cap, the rarest double; the middle ones in between.
      weight * lerp(1, 0.5 + index * 0.375, bonus),
  )
}

/** The chance that a treasure is shiny, rising with the distance flown. */
export function shinyChance(distance: number): number {
  return lerp(1 / 48, 1 / 12, clamp01(distance / DISTANCE_CAP))
}

export interface Reward {
  readonly item: Item
  readonly shiny: boolean
}

export interface RewardRoll {
  readonly world: WorldId
  readonly tier: HoleTier
  readonly distance: number
  /** Ids of the items found before. */
  readonly found: ReadonlySet<string>
}

/**
 * The treasure waiting in a world. A hole with a flower aura always holds the world's legendary
 * treasure until it has been found once; after that it rolls like the rest.
 */
export function rollReward(random: Random, { world, tier, distance, found }: RewardRoll): Reward {
  const candidates = itemsOf(world)
  const legendary = candidates.find((entry) => entry.rarity === 'legendary')
  const shiny = random() < shinyChance(distance)
  if (tier === 4 && legendary && !found.has(legendary.id)) return { item: legendary, shiny }
  const weights = rarityWeights(tier, distance)
  const rarity = pickWeighted(
    random,
    RARITIES.map((value, index) => [value, weights[index] ?? 0] as const),
  )
  const chosen = candidates.find((entry) => entry.rarity === rarity) ?? candidates[0]
  if (!chosen) throw new Error(`World ${world} has no treasures`)
  return { item: chosen, shiny }
}

/** Every world has one treasure of each rarity. */
export function checkItems(): boolean {
  return WORLD_IDS.every((world) =>
    RARITIES.every((rarity) =>
      ITEMS.some((entry) => entry.world === world && entry.rarity === rarity),
    ),
  )
}
