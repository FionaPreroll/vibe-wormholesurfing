import type { PropKind } from '../../core/layouts'
import type { WorldId } from '../../core/worlds'

/** How a world looks: sky, light, fog, ground, water and the colors of its scenery. */
export interface WorldTheme {
  readonly sky: {
    readonly zenith: number
    readonly horizon: number
    /** The color below the horizon: haze, a sea of clouds or the void. */
    readonly below: number
    readonly sun: number
    /** Direction toward the sun, not normalized. */
    readonly sunDir: readonly [number, number, number]
    readonly sunSize: number
    readonly stars: number
    readonly aurora: number
    readonly clouds: number
    readonly planet?: {
      readonly dir: readonly [number, number, number]
      readonly size: number
      readonly color: number
    }
  }
  readonly fog: { readonly color: number; readonly near: number; readonly far: number }
  readonly light: {
    readonly sun: number
    readonly sunIntensity: number
    readonly skyAmbient: number
    readonly groundAmbient: number
    readonly ambientIntensity: number
  }
  /** Ground colors: low, middle and high ground, steep slopes, and beaches by water. */
  readonly ground: {
    readonly low: number
    readonly mid: number
    readonly high: number
    readonly steep: number
    readonly shore?: number
  }
  readonly water?: { readonly shallow: number; readonly deep: number; readonly foam: number }
  /** Colors per kind of prop: the first is the body, the second leaves, caps or glow. */
  readonly props: Partial<Readonly<Record<PropKind, readonly [number, number?]>>>
  /** Floating things in the air. */
  readonly motes: {
    readonly color: number
    readonly count: number
    readonly size: number
    readonly rise: number
  }
  readonly exposure: number
  readonly bloom: number
  /** Floating islands around the edge, for worlds that float. */
  readonly islands?: boolean
}

export const THEMES: Readonly<Record<WorldId, WorldTheme>> = {
  cliffs: {
    sky: {
      zenith: 0x2a1650,
      horizon: 0xff8a5c,
      below: 0xd9776a,
      sun: 0xffc48a,
      sunDir: [-0.6, 0.14, -0.75],
      sunSize: 0.05,
      stars: 0.15,
      aurora: 0,
      clouds: 0.55,
    },
    fog: { color: 0xd47466, near: 45, far: 240 },
    light: {
      sun: 0xffb27a,
      sunIntensity: 2.6,
      skyAmbient: 0xa77ad8,
      groundAmbient: 0x7a3a2a,
      ambientIntensity: 0.9,
    },
    ground: { low: 0xb5553f, mid: 0xc9714f, high: 0xe0a27a, steep: 0x7d3530 },
    props: {
      rock: [0x9b4a3c],
      boulder: [0x8f4535],
      mesa: [0xa8503c],
      deadTree: [0x5a3a2e],
      shrub: [0xd8b468],
      crystal: [0xff5577, 0xff3366],
    },
    motes: { color: 0xffa060, count: 160, size: 0.12, rise: 0.3 },
    exposure: 1.0,
    bloom: 0.55,
  },
  lagoon: {
    sky: {
      zenith: 0x2a76de,
      horizon: 0xc4ecff,
      below: 0x9fd8f0,
      sun: 0xfff6d8,
      sunDir: [0.45, 0.75, 0.35],
      sunSize: 0.035,
      stars: 0,
      aurora: 0,
      clouds: 0.75,
    },
    fog: { color: 0xb8e2ff, near: 80, far: 340 },
    light: {
      sun: 0xfff1d6,
      sunIntensity: 3.0,
      skyAmbient: 0x9fd0ff,
      groundAmbient: 0x5f8f5a,
      ambientIntensity: 1.1,
    },
    ground: { low: 0x62ad55, mid: 0x4f9a4f, high: 0x6f9a68, steep: 0x7f8f78, shore: 0xf2deb0 },
    water: { shallow: 0x4ff0dc, deep: 0x1557c8, foam: 0xffffff },
    props: {
      palm: [0x9b7450, 0x34b85a],
      boulder: [0x8a9aa0],
      rock: [0x9aa6aa],
      bush: [0x3fae58],
      flower: [0xff8fc8],
      grass: [0x6ccf5f],
      coral: [0xff7aa8],
    },
    motes: { color: 0xffffff, count: 90, size: 0.08, rise: 0.15 },
    exposure: 0.95,
    bloom: 0.35,
  },
  canyon: {
    sky: {
      zenith: 0x3f86d6,
      horizon: 0xeef3d0,
      below: 0xc8dcb8,
      sun: 0xffe2a8,
      sunDir: [0.55, 0.42, -0.45],
      sunSize: 0.04,
      stars: 0,
      aurora: 0,
      clouds: 0.6,
    },
    fog: { color: 0xc9dcc0, near: 55, far: 260 },
    light: {
      sun: 0xffe1b0,
      sunIntensity: 2.8,
      skyAmbient: 0xaed0ff,
      groundAmbient: 0x5a6a3a,
      ambientIntensity: 1.0,
    },
    ground: { low: 0x5f9a48, mid: 0x86ad5a, high: 0xa89a7c, steep: 0x7d7062 },
    props: {
      tree: [0x6b4a32, 0x3f9a4a],
      boulder: [0x9a907c],
      rock: [0x8f8672],
      bush: [0x4f9f44],
      grass: [0x7ab855],
      flower: [0xfff07a],
    },
    motes: { color: 0xfff8b0, count: 120, size: 0.07, rise: 0.2 },
    exposure: 0.95,
    bloom: 0.35,
  },
  caverns: {
    sky: {
      zenith: 0x0d0805,
      horizon: 0x1e130a,
      below: 0x140c06,
      sun: 0xffcc66,
      sunDir: [0.2, 0.9, 0.1],
      sunSize: 0,
      stars: 0,
      aurora: 0,
      clouds: 0,
    },
    fog: { color: 0x1c120a, near: 12, far: 95 },
    light: {
      sun: 0xffc870,
      sunIntensity: 0.55,
      skyAmbient: 0x6a4a2a,
      groundAmbient: 0x20140a,
      ambientIntensity: 0.9,
    },
    ground: { low: 0x4a3a2a, mid: 0x5e4834, high: 0x6b5238, steep: 0x352a20 },
    props: {
      crystal: [0xffc233, 0xffb000],
      crystalPillar: [0xffd36b, 0xffa020],
      mushroom: [0xe8d8c0, 0x7ff0ff],
      stalagmite: [0x5a4634],
      rock: [0x4e3e2e],
    },
    motes: { color: 0xffd060, count: 220, size: 0.09, rise: 0.25 },
    exposure: 1.15,
    bloom: 0.9,
  },
  crystalSea: {
    sky: {
      zenith: 0x7f9fff,
      horizon: 0xffe6f4,
      below: 0xdfe8ff,
      sun: 0xfff0f8,
      sunDir: [-0.35, 0.28, -0.8],
      sunSize: 0.045,
      stars: 0.05,
      aurora: 0,
      clouds: 0.4,
    },
    fog: { color: 0xe6e4ff, near: 60, far: 280 },
    light: {
      sun: 0xffeef6,
      sunIntensity: 2.5,
      skyAmbient: 0xc8d4ff,
      groundAmbient: 0xa8b8ff,
      ambientIntensity: 1.2,
    },
    ground: { low: 0xe6e2f6, mid: 0xf4f1ff, high: 0xd6d8f0, steep: 0xb8bce0, shore: 0xfdfbff },
    water: { shallow: 0xbff4ff, deep: 0x6f8fff, foam: 0xffffff },
    props: {
      crystalPillar: [0xd9e2ff, 0xa6c8ff],
      crystal: [0xe9f0ff, 0xc8b8ff],
      rock: [0xc8cce6],
      coral: [0xb8f0ff],
    },
    motes: { color: 0xffffff, count: 200, size: 0.07, rise: 0.12 },
    exposure: 0.9,
    bloom: 0.6,
  },
  starDunes: {
    sky: {
      zenith: 0x080725,
      horizon: 0x40285e,
      below: 0x2a1c3a,
      sun: 0xbfd2ff,
      sunDir: [-0.3, 0.55, 0.6],
      sunSize: 0.02,
      stars: 1,
      aurora: 0,
      clouds: 0.15,
      planet: { dir: [0.5, 0.35, -0.8], size: 0.16, color: 0xffb38a },
    },
    fog: { color: 0x2c2045, near: 50, far: 250 },
    light: {
      sun: 0xa8c0ff,
      sunIntensity: 1.8,
      skyAmbient: 0x6a5ab8,
      groundAmbient: 0x3a2a3a,
      ambientIntensity: 1.0,
    },
    ground: { low: 0xb08560, mid: 0xc79a6c, high: 0xe0bc88, steep: 0x8a6a52 },
    props: {
      spire: [0x7a5a4c],
      rock: [0x8a6a58],
      boulder: [0x7d604f],
      crystal: [0x9fd8ff, 0x6fc8ff],
      shrub: [0xb0a070],
    },
    motes: { color: 0xbfe0ff, count: 140, size: 0.08, rise: 0.08 },
    exposure: 1.05,
    bloom: 0.6,
  },
  floatingGardens: {
    sky: {
      zenith: 0x6fb0ff,
      horizon: 0xffe6f4,
      below: 0xfdf6ff,
      sun: 0xfff8e0,
      sunDir: [0.3, 0.6, 0.55],
      sunSize: 0.04,
      stars: 0,
      aurora: 0,
      clouds: 0.9,
    },
    fog: { color: 0xf3e8ff, near: 70, far: 320 },
    light: {
      sun: 0xfff4e0,
      sunIntensity: 2.8,
      skyAmbient: 0xc8e0ff,
      groundAmbient: 0xa8d890,
      ambientIntensity: 1.15,
    },
    ground: { low: 0x88d880, mid: 0x9ee290, high: 0xb8e8a0, steep: 0xa08a78 },
    props: {
      blossomTree: [0x8a5a4a, 0xffb0dc],
      bush: [0x6fcf70],
      flower: [0xffffff],
      grass: [0x8ee080],
      lantern: [0x7a5a4a, 0xffd890],
      rock: [0xc0b0a8],
    },
    motes: { color: 0xffc0e0, count: 180, size: 0.1, rise: -0.25 },
    exposure: 0.95,
    bloom: 0.4,
    islands: true,
  },
  auroraVoid: {
    sky: {
      zenith: 0x040212,
      horizon: 0x140838,
      below: 0x05020f,
      sun: 0x9fffe8,
      sunDir: [0.2, 0.6, -0.4],
      sunSize: 0,
      stars: 1,
      aurora: 1,
      clouds: 0,
    },
    fog: { color: 0x0c0626, near: 40, far: 220 },
    light: {
      sun: 0x9fe8ff,
      sunIntensity: 1.2,
      skyAmbient: 0x5a4ab8,
      groundAmbient: 0x1a1030,
      ambientIntensity: 1.0,
    },
    ground: { low: 0x1e1838, mid: 0x2a2250, high: 0x3a2f6a, steep: 0x151028 },
    props: {
      spire: [0x231a40],
      monolith: [0x1a1530, 0x5cf2ff],
      crystal: [0x5cf2ff, 0xb06bff],
      rock: [0x2a2245],
    },
    motes: { color: 0x7ffff0, count: 220, size: 0.09, rise: 0.18 },
    exposure: 1.1,
    bloom: 0.85,
    islands: true,
  },
}
