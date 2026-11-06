import type { Land } from './land'
import { angleDelta } from './math'
import type { Blocker } from './scatter'

export interface Point3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** A camera around a point it looks at: turned by `yaw`, raised by `pitch`, `distance` away. */
export interface View {
  readonly yaw: number
  readonly pitch: number
  readonly distance: number
}

/** Where a camera with a view of a point stands. */
export function viewFrom(focus: Point3, view: View): Point3 {
  const flat = Math.cos(view.pitch) * view.distance
  return {
    x: focus.x + Math.sin(view.yaw) * flat,
    y: focus.y + Math.sin(view.pitch) * view.distance,
    z: focus.z + Math.cos(view.yaw) * flat,
  }
}

/** How tall scenery stands above the ground, by how wide it blocks: rocks, crystals, trees. */
const blockerHeight = (blocker: Blocker) => 1.5 + blocker.radius * 2.5

/** How far the line of sight keeps from the ground and from scenery. */
const MARGIN = 0.35

/** How far above the ground the camera keeps, as the world's camera does. */
export const CAMERA_CLEARANCE = 0.7

/**
 * Whether a camera with this view sees the point: it stands above the ground and under a cave's
 * ceiling, and neither the ground nor scenery rises into the line between them.
 */
export function clearView(
  land: Land,
  blockers: readonly Blocker[],
  focus: Point3,
  view: View,
  ceiling?: number,
): boolean {
  const camera = viewFrom(focus, view)
  if (camera.y < land.heightAt(camera.x, camera.z) + CAMERA_CLEARANCE) return false
  if (ceiling !== undefined && camera.y > ceiling - 2) return false
  const steps = Math.max(4, Math.ceil(view.distance / 0.4))
  for (let step = 1; step <= steps; step++) {
    const t = step / steps
    const x = focus.x + (camera.x - focus.x) * t
    const y = focus.y + (camera.y - focus.y) * t
    const z = focus.z + (camera.z - focus.z) * t
    if (land.heightAt(x, z) + MARGIN > y) return false
    for (const blocker of blockers) {
      const reach = blocker.radius + MARGIN
      if ((x - blocker.x) ** 2 + (z - blocker.z) ** 2 > reach * reach) continue
      if (y < land.heightAt(blocker.x, blocker.z) + blockerHeight(blocker)) return false
    }
  }
  return true
}

/**
 * How the camera may stand to watch the treasure open, from the nearest first: from the side, at
 * eye level, then higher and closer, which sees over a wall or a rock that the side view runs
 * into. The last is high above, which sees everything but a ceiling.
 */
const REVEAL_VIEWS = [
  { pitch: 0.26, distance: 6.4 },
  { pitch: 0.45, distance: 5.6 },
  { pitch: 0.7, distance: 4.8 },
  { pitch: 1.0, distance: 4.2 },
] as const

/** Directions tried around the treasure, a fifteenth of a turn apart. */
const TURNS = 24

/**
 * The view for watching the treasure open: the girl and the capsule side by side, from the side
 * nearest to where the camera already is, as long as nothing stands in the way. Where a wall or
 * scenery blocks that side, the camera turns round to a side that is clear, or rises over it,
 * instead of pushing into the wall and looking at its inside.
 */
export function revealView(
  land: Land,
  blockers: readonly Blocker[],
  girl: Point3,
  treasure: { readonly x: number; readonly z: number },
  currentYaw: number,
  ceiling?: number,
): View & { readonly focus: Point3 } {
  const focus = {
    x: girl.x * 0.4 + treasure.x * 0.6,
    y: girl.y + 1.5,
    z: girl.z * 0.4 + treasure.z * 0.6,
  }
  const along = Math.atan2(treasure.x - girl.x, treasure.z - girl.z)
  const sides = [along + Math.PI / 2, along - Math.PI / 2]
  const nearest = sides.reduce((best, side) =>
    Math.abs(angleDelta(currentYaw, side)) < Math.abs(angleDelta(currentYaw, best)) ? side : best,
  )
  // Every direction, those nearest the side view first, then the one the camera is nearer to.
  const yaws = Array.from({ length: TURNS }, (_, index) => nearest + (index * 2 * Math.PI) / TURNS)
    .map((yaw) => ({
      yaw,
      cost:
        Math.min(...sides.map((side) => Math.abs(angleDelta(yaw, side)))) +
        Math.abs(angleDelta(currentYaw, yaw)) * 0.25,
    }))
    .sort((a, b) => a.cost - b.cost)
  for (const { pitch, distance } of REVEAL_VIEWS) {
    for (const { yaw } of yaws) {
      const view = { yaw, pitch, distance }
      if (clearView(land, blockers, focus, view, ceiling)) return { ...view, focus }
    }
  }
  return { yaw: nearest, pitch: 1.2, distance: 4, focus }
}

/**
 * How shut in a spot is, from 0 to 1: the share of points around it, near and a little farther,
 * whose ground rises steeply above it. A capsule in a hollow or at the foot of a wall is hard to
 * see and to frame; an open spot is neither.
 */
export function enclosure(land: Land, x: number, z: number): number {
  const ground = land.heightAt(x, z)
  let shut = 0
  let count = 0
  for (const radius of [3, 6]) {
    for (let index = 0; index < 8; index++) {
      const angle = (index / 8) * Math.PI * 2 + radius
      const rise =
        land.heightAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius) - ground
      // Steeper than about one in two.
      if (rise > radius * 0.5) shut++
      count++
    }
  }
  return shut / count
}
