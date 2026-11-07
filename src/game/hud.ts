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

/**
 * The ride's speed and pull as they are every frame, for the sound, which follows them smoothly.
 * The HUD shows them rounded and less often (see `nextRideHud`).
 */
export const rideFeel = { speed: 1, pull: 0 }

/** How often, at most, the counting numbers and the gauge change: their digits need no more. */
export const HUD_STEP_MS = 50

/**
 * What the HUD shows next, from what the ride says now: the values as shown (the speed and the
 * pull to a hundredth and a fiftieth, the time to the second), and the same object as before
 * while none of them changed, so the cockpit is drawn again only when something on it changes.
 * Counts that jump, as orbs, sparks, a chain or being caught, show at once; the light-years, the
 * gauge and the clock at most every `HUD_STEP_MS`. Set every frame, the cockpit had the browser
 * restyle and repaint it every frame, which cost phones more than a lower resolution could win.
 */
export function nextRideHud(previous: RideHud, now: RideHud, sinceShownMs: number): RideHud {
  const shown: RideHud = {
    ...now,
    speed: Math.round(now.speed * 100) / 100,
    pull: Math.round(now.pull * 50) / 50,
    time: Math.floor(now.time),
  }
  const jumped =
    shown.combo !== previous.combo ||
    shown.stunned !== previous.stunned ||
    shown.captured !== previous.captured ||
    shown.warping !== previous.warping ||
    shown.orbs !== previous.orbs ||
    shown.sparks !== previous.sparks
  if (!jumped && sinceShownMs < HUD_STEP_MS) return previous
  const same = (Object.keys(shown) as (keyof RideHud)[]).every(
    (key) => shown[key] === previous[key],
  )
  return same ? previous : shown
}

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
