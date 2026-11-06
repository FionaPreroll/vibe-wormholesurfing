import { clearView, enclosure, type Point3, revealView, type View } from './framing'
import type { HoleTier } from './holes'
import { type Land, makeLand } from './land'
import { LAYOUTS, type WorldLayout } from './layouts'
import { length2 } from './math'
import { type Random, seededRandom } from './random'
import { type Reward, rollReward } from './rewards'
import { type Blocker, blockersOf, type Prop, scatterProps } from './scatter'
import { WALK, Walker, type WalkInput } from './walker'
import type { WorldId } from './worlds'

/** How close the player must be to open the treasure. */
export const REACH = 2.4
/** The radius of the capsule's pedestal, which the player cannot walk through. */
export const CAPSULE_RADIUS = 1.15
/** Seconds the treasure takes to open before it shows what it holds. */
export const OPEN_TIME = 2.4

export type ExpeditionPhase = 'exploring' | 'opening' | 'revealed'

export type ExpeditionEvent =
  | { readonly type: 'jump' }
  | { readonly type: 'land' }
  | { readonly type: 'open' }
  | { readonly type: 'reveal'; readonly reward: Reward }

export interface ExpeditionOptions {
  readonly world: WorldId
  readonly seed: number
  readonly tier: HoleTier
  /** Light-years flown to get here. */
  readonly distance: number
  /** Treasures found before, so a flower-aura hole knows whether its legendary one is left. */
  readonly found: ReadonlySet<string>
}

export interface Point {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * A visit to the world behind a warp hole: the land, its scenery, the player on foot, and one
 * treasure somewhere out there whose contents were decided by the hole.
 */
export class Expedition {
  readonly world: WorldId
  readonly seed: number
  readonly tier: HoleTier
  readonly distance: number
  readonly layout: WorldLayout
  readonly land: Land
  readonly props: readonly Prop[]
  readonly blockers: readonly Blocker[]
  readonly walker: Walker
  readonly treasure: Point
  /** The scenery that stands in the way, without the capsule. */
  readonly scenery: readonly Blocker[]
  readonly reward: Reward
  phase: ExpeditionPhase = 'exploring'
  /** Seconds since the treasure began to open. */
  opening = 0
  time = 0

  constructor({ world, seed, tier, distance, found }: ExpeditionOptions) {
    this.world = world
    this.seed = seed
    this.tier = tier
    this.distance = distance
    const random = seededRandom(seed)
    this.layout = LAYOUTS[world]
    this.land = makeLand(this.layout.land, seed)
    this.props = scatterProps(random, this.land, this.layout)
    const scenery = blockersOf(this.props)
    this.scenery = scenery
    const spot = placeTreasure(random, this.land, scenery, this.layout.ceiling)
    this.treasure = { x: spot.x, y: this.land.heightAt(spot.x, spot.z), z: spot.z }
    // The capsule's pedestal is solid: the girl walks up to it, not into it.
    this.blockers = [...scenery, { x: spot.x, z: spot.z, radius: CAPSULE_RADIUS }]
    this.reward = rollReward(random, { world, tier, distance, found })
    // The player starts beside the ship, facing roughly toward the treasure's glow.
    const facing = Math.atan2(spot.x, spot.z) + (random() - 0.5) * 0.8
    this.walker = new Walker(
      this.land,
      this.blockers,
      Math.sin(facing) * 2.5,
      Math.cos(facing) * 2.5,
      facing,
    )
  }

  /**
   * How the camera watches the treasure open, from where it looks now: from the side, clear of
   * walls and scenery (see `revealView`).
   */
  revealView(currentYaw: number): View & { readonly focus: Point3 } {
    const walker = this.walker
    return revealView(
      this.land,
      this.scenery,
      { x: walker.x, y: walker.y, z: walker.z },
      this.treasure,
      currentYaw,
      this.layout.ceiling,
    )
  }

  /** Distance from the player to the treasure, along the ground. */
  get treasureDistance(): number {
    return length2(this.treasure.x - this.walker.x, this.treasure.z - this.walker.z)
  }

  get canOpen(): boolean {
    return this.phase === 'exploring' && this.treasureDistance < REACH
  }

  step(dt: number, input: WalkInput, interact: boolean): ExpeditionEvent[] {
    const events: ExpeditionEvent[] = []
    this.time += dt
    if (this.phase === 'exploring') {
      const { jumped, landed } = this.walker.step(dt, input)
      if (jumped) events.push({ type: 'jump' })
      if (landed) events.push({ type: 'land' })
      if (interact && this.canOpen) {
        this.phase = 'opening'
        this.opening = 0
        events.push({ type: 'open' })
      }
    } else {
      // While the treasure opens, the player stands still and faces it.
      const walker = this.walker
      walker.step(dt, { x: 0, z: 0, jump: false })
      walker.yaw = Math.atan2(this.treasure.x - walker.x, this.treasure.z - walker.z)
      if (this.phase === 'opening') {
        this.opening += dt
        if (this.opening >= OPEN_TIME) {
          this.phase = 'revealed'
          events.push({ type: 'reveal', reward: this.reward })
        }
      }
    }
    return events
  }
}

const CELL = 2

/** How many spots for the treasure are weighed for how open they are. */
const SPOTS_WEIGHED = 48

/**
 * Whether the camera can watch a treasure open here from several sides at eye level: the girl
 * may come from anywhere, and the camera takes the side nearer to it.
 */
function watchable(
  land: Land,
  blockers: readonly Blocker[],
  spot: { readonly x: number; readonly z: number },
  ceiling?: number,
): boolean {
  const focus = { x: spot.x, y: land.heightAt(spot.x, spot.z) + 1.5, z: spot.z }
  let clear = 0
  for (let index = 0; index < 8; index++) {
    const view = { yaw: (index / 8) * Math.PI * 2, pitch: 0.26, distance: 6.4 }
    if (clearView(land, blockers, focus, view, ceiling)) clear++
  }
  return clear >= 4
}

/**
 * A place for the treasure that the player can walk to from the landing site: a search over a
 * grid of cells, stepping only between walkable cells whose ground is not a wall apart.
 */
export function placeTreasure(
  random: Random,
  land: Land,
  blockers: readonly Blocker[],
  ceiling?: number,
): { x: number; z: number } {
  const bounds = land.shape.bounds - 3
  const size = Math.ceil(bounds / CELL)
  const free = (x: number, z: number) =>
    land.walkable(x, z) &&
    blockers.every((blocker) => length2(x - blocker.x, z - blocker.z) > blocker.radius + 1.2)
  const key = (i: number, j: number) => `${i},${j}`
  const seen = new Set<string>([key(0, 0)])
  const queue: [number, number][] = [[0, 0]]
  const reachable: { x: number; z: number; distance: number }[] = []
  while (queue.length > 0) {
    const [i, j] = queue.shift() as [number, number]
    const x = i * CELL
    const z = j * CELL
    reachable.push({ x, z, distance: length2(x, z) })
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const ni = i + di
      const nj = j + dj
      if (Math.abs(ni) > size || Math.abs(nj) > size || seen.has(key(ni, nj))) continue
      const nx = ni * CELL
      const nz = nj * CELL
      if (!free(nx, nz)) continue
      const rise = land.floorAt(nx, nz) - land.floorAt(x, z)
      if (rise / CELL > WALK.wall * 0.8) continue
      seen.add(key(ni, nj))
      queue.push([ni, nj])
    }
  }
  const water = land.shape.water
  const dry = (spot: { x: number; z: number }) =>
    water === undefined || land.heightAt(spot.x, spot.z) > water + 0.1
  const far = Math.min(52, bounds - 4)
  const near = Math.min(30, far * 0.6)
  const wanted = reachable.filter(
    (spot) => spot.distance >= near && spot.distance <= far && free(spot.x, spot.z),
  )
  const choice = wanted.filter(dry).length > 0 ? wanted.filter(dry) : wanted
  if (choice.length > 0) {
    // Open ground first: in a hollow or at the foot of a wall the capsule hides, and the camera
    // has no room to watch it open. Spots spread evenly over the choice, from one picked at
    // random, are weighed, the most open first, and the first the camera can watch from
    // several sides wins.
    const start = Math.floor(random() * choice.length)
    const count = Math.min(SPOTS_WEIGHED, choice.length)
    const weighed = Array.from({ length: count }, (_, index) => {
      const spot = choice[
        (start + Math.floor((index * choice.length) / count)) % choice.length
      ] as (typeof choice)[0]
      return { spot, shut: enclosure(land, spot.x, spot.z) }
    }).sort((a, b) => a.shut - b.shut)
    for (const { spot } of weighed) if (watchable(land, blockers, spot, ceiling)) return spot
    return (weighed[0] as (typeof weighed)[0]).spot
  }
  // A closed-in landing site: the farthest reachable place will do.
  return reachable.reduce((best, spot) => (spot.distance > best.distance ? spot : best))
}
