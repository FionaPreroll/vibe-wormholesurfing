import type { WorldId } from './worlds'

/** Kinds of scenery. The view gives each a model; the rules only need where and how wide. */
export const PROP_KINDS = [
  'rock',
  'boulder',
  'mesa',
  'tree',
  'palm',
  'deadTree',
  'blossomTree',
  'bush',
  'grass',
  'flower',
  'shrub',
  'coral',
  'crystal',
  'crystalPillar',
  'spire',
  'mushroom',
  'stalagmite',
  'monolith',
  'lantern',
] as const
export type PropKind = (typeof PROP_KINDS)[number]

/** Where a kind of prop goes in a world. */
export interface PropRule {
  readonly kind: PropKind
  readonly count: number
  /** Size range; 1 is the model as built. */
  readonly scale: readonly [number, number]
  /** Radius that blocks walking, per unit of scale, or 0 to walk through. */
  readonly block: number
  /** Distance from the landing site where it may stand. */
  readonly from?: number
  readonly to?: number
  /** Only under water, or only on dry land when the world has water. */
  readonly underwater?: boolean
}

/** The shape of a world's ground, in units; the player is about 1.4 tall. */
export interface LandShape {
  readonly base: number
  readonly hills: number
  readonly hillScale: number
  readonly ridges: number
  readonly ridgeScale: number
  /** Height of soft steps that the ground falls into, as in mesas; 0 for none. */
  readonly terrace: number
  /** Height added toward the edge: mountains around a valley, or a drop when negative. */
  readonly rim: number
  /** Where the rim starts and where it is complete. */
  readonly rimFrom: number
  readonly rimTo: number
  /** Height of the landing site, flattened around the middle. */
  readonly landing: number
  /** Level of water, if the world has any. */
  readonly water?: number
  /** The player may not walk farther than this from the middle. */
  readonly bounds: number
}

export interface WorldLayout {
  readonly land: LandShape
  readonly props: readonly PropRule[]
  /** A ceiling, for worlds under ground: its height above the landing site. */
  readonly ceiling?: number
}

const rule = (
  kind: PropKind,
  count: number,
  scale: readonly [number, number],
  block: number,
  extra: Partial<PropRule> = {},
): PropRule => ({ kind, count, scale, block, ...extra })

export const LAYOUTS: Readonly<Record<WorldId, WorldLayout>> = {
  cliffs: {
    land: {
      base: 0,
      hills: 3,
      hillScale: 0.022,
      ridges: 11,
      ridgeScale: 0.016,
      terrace: 3.2,
      rim: 34,
      rimFrom: 70,
      rimTo: 115,
      landing: 1,
      bounds: 72,
    },
    props: [
      rule('mesa', 14, [0.8, 1.6], 2.6, { from: 55, to: 120 }),
      rule('boulder', 26, [0.7, 1.4], 1.3, { from: 12, to: 75 }),
      rule('rock', 110, [0.3, 1], 0),
      rule('deadTree', 22, [0.8, 1.3], 0.35, { from: 10, to: 72 }),
      rule('shrub', 1400, [0.6, 1.5], 0, { to: 85 }),
      rule('crystal', 14, [0.6, 1.4], 0.6, { from: 15, to: 72 }),
    ],
  },
  lagoon: {
    land: {
      base: -0.6,
      hills: 4.6,
      hillScale: 0.028,
      ridges: 0,
      ridgeScale: 0.02,
      terrace: 0,
      rim: 26,
      rimFrom: 72,
      rimTo: 112,
      landing: 1.1,
      water: 0,
      bounds: 74,
    },
    props: [
      rule('palm', 44, [0.8, 1.3], 0.4, { from: 8, to: 90 }),
      rule('boulder', 30, [0.6, 1.4], 1.2, { from: 10, to: 80 }),
      rule('rock', 90, [0.3, 0.9], 0),
      rule('bush', 120, [0.6, 1.2], 0),
      rule('flower', 700, [0.7, 1.2], 0, { to: 85 }),
      rule('grass', 4800, [1.1, 2.1], 0, { to: 85 }),
      rule('coral', 140, [0.5, 1.3], 0, { underwater: true }),
    ],
  },
  canyon: {
    land: {
      base: 0,
      hills: 5,
      hillScale: 0.02,
      ridges: 9,
      ridgeScale: 0.017,
      terrace: 0,
      rim: 30,
      rimFrom: 68,
      rimTo: 112,
      landing: 1,
      bounds: 72,
    },
    props: [
      rule('tree', 110, [0.8, 1.6], 0.45, { from: 9, to: 110 }),
      rule('boulder', 34, [0.6, 1.5], 1.3, { from: 10, to: 85 }),
      rule('rock', 120, [0.3, 1], 0),
      rule('bush', 220, [0.6, 1.4], 0, { to: 90 }),
      rule('grass', 6500, [1.1, 2.2], 0, { to: 85 }),
      rule('flower', 800, [0.7, 1.2], 0, { to: 85 }),
    ],
  },
  caverns: {
    land: {
      base: 0,
      hills: 2.6,
      hillScale: 0.03,
      ridges: 5,
      ridgeScale: 0.024,
      terrace: 0,
      rim: 34,
      rimFrom: 64,
      rimTo: 96,
      landing: 0.8,
      bounds: 66,
    },
    ceiling: 24,
    props: [
      rule('crystal', 70, [0.6, 1.8], 0.55, { from: 8, to: 80 }),
      rule('crystalPillar', 12, [0.8, 1.4], 1.2, { from: 18, to: 70 }),
      rule('mushroom', 220, [0.5, 1.6], 0.25, { from: 6, to: 75 }),
      rule('stalagmite', 70, [0.6, 1.6], 0.7, { from: 10, to: 90 }),
      rule('rock', 90, [0.3, 1], 0),
    ],
  },
  crystalSea: {
    land: {
      base: -0.55,
      hills: 1.8,
      hillScale: 0.03,
      ridges: 0,
      ridgeScale: 0.02,
      terrace: 0,
      rim: 12,
      rimFrom: 74,
      rimTo: 120,
      landing: 0.6,
      water: 0.12,
      bounds: 74,
    },
    props: [
      rule('crystalPillar', 40, [0.8, 2], 1.1, { from: 14, to: 120 }),
      rule('crystal', 260, [0.4, 1.4], 0, { from: 6, to: 110 }),
      rule('rock', 40, [0.3, 0.8], 0),
      rule('coral', 60, [0.4, 1], 0, { underwater: true }),
    ],
  },
  starDunes: {
    land: {
      base: 0,
      hills: 2.5,
      hillScale: 0.018,
      ridges: 7,
      ridgeScale: 0.026,
      terrace: 0,
      rim: 20,
      rimFrom: 70,
      rimTo: 115,
      landing: 1,
      bounds: 72,
    },
    props: [
      rule('spire', 18, [0.8, 1.6], 1.4, { from: 20, to: 110 }),
      rule('rock', 60, [0.3, 1], 0),
      rule('boulder', 16, [0.6, 1.2], 1.1, { from: 12, to: 80 }),
      rule('crystal', 70, [0.6, 1.5], 0.5, { from: 8, to: 80 }),
      rule('shrub', 500, [0.6, 1.2], 0, { to: 85 }),
    ],
  },
  floatingGardens: {
    land: {
      base: 1,
      hills: 3.2,
      hillScale: 0.024,
      ridges: 0,
      ridgeScale: 0.02,
      terrace: 0,
      rim: -46,
      rimFrom: 62,
      rimTo: 84,
      landing: 1.4,
      bounds: 60,
    },
    props: [
      rule('blossomTree', 46, [0.8, 1.4], 0.5, { from: 9, to: 58 }),
      rule('bush', 120, [0.6, 1.2], 0, { to: 60 }),
      rule('flower', 1600, [0.7, 1.3], 0, { to: 60 }),
      rule('grass', 5200, [1.1, 2], 0, { to: 61 }),
      rule('lantern', 22, [0.9, 1.1], 0.3, { from: 8, to: 56 }),
      rule('rock', 40, [0.3, 0.9], 0, { to: 60 }),
    ],
  },
  auroraVoid: {
    land: {
      base: 0,
      hills: 1.4,
      hillScale: 0.03,
      ridges: 2.5,
      ridgeScale: 0.03,
      terrace: 1.2,
      rim: -40,
      rimFrom: 60,
      rimTo: 80,
      landing: 0.8,
      bounds: 58,
    },
    props: [
      rule('spire', 30, [0.7, 1.6], 1.2, { from: 14, to: 57 }),
      rule('monolith', 10, [0.9, 1.4], 1, { from: 16, to: 52 }),
      rule('crystal', 120, [0.4, 1.4], 0, { to: 58 }),
      rule('rock', 50, [0.3, 0.9], 0, { to: 58 }),
    ],
  },
}
