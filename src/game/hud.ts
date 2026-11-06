import { signal } from '@preact/signals-core'
import type { HoleColor, HoleTier } from '../core/holes'
import type { Reward } from '../core/rewards'
import type { WorldId } from '../core/worlds'

/** What the screen shows over the ride. The ride's view writes it every frame. */
export interface RideHud {
  /** Light-years flown. */
  readonly distance: number
  readonly speed: number
  /** How hard holes pull, from 0 to 1. */
  readonly pull: number
  readonly combo: number
  readonly stunned: boolean
  /** A hole has the ship in its grip. */
  readonly captured: boolean
  readonly warping: boolean
  readonly orbs: number
  readonly sparks: number
  /** Seconds since the ride began. */
  readonly time: number
}

export const rideHud = signal<RideHud>({
  distance: 0,
  speed: 1,
  pull: 0,
  combo: 0,
  stunned: false,
  captured: false,
  warping: false,
  orbs: 0,
  sparks: 0,
  time: 0,
})

/** What the screen shows in a world. */
export interface WorldHud {
  /** Direction to the treasure on screen, in radians clockwise from straight ahead. */
  readonly treasureBearing: number
  /** Meters to the treasure. */
  readonly treasureDistance: number
  readonly canOpen: boolean
  readonly phase: 'exploring' | 'opening' | 'revealed'
}

export const worldHud = signal<WorldHud>({
  treasureBearing: 0,
  treasureDistance: 0,
  canOpen: false,
  phase: 'exploring',
})

/** Where a ride ended, and so where the player arrives. */
export interface Arrival {
  readonly color: HoleColor
  readonly tier: HoleTier
  readonly distance: number
  readonly world: WorldId
  readonly seed: number
}

/** What the last treasure held, with whether it is new to the collection. */
export interface Found {
  readonly reward: Reward
  readonly world: WorldId
  readonly tier: HoleTier
  readonly distance: number
  readonly fresh: boolean
  readonly count: number
}
