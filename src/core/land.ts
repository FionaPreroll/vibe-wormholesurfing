import type { LandShape } from './layouts'
import { smoothstep } from './math'
import { fbm, type Noise2, ridged, simplex2 } from './noise'

/** Radius of the flat ground where the ship lands. */
export const LANDING_RADIUS = 9

/** The height of a world's ground everywhere, the same for the rules and the picture. */
export interface Land {
  readonly shape: LandShape
  heightAt(x: number, z: number): number
  /** Steepness at a point: rise per unit of distance. */
  slopeAt(x: number, z: number): number
  /**
   * What the player stands on: the ground, or in deep water the level she floats at while she
   * swims, her head above the surface.
   */
  floorAt(x: number, z: number): number
  /** Whether the water here is too deep to wade, so the player swims. */
  swimming(x: number, z: number): boolean
  /** Whether the player may be here: inside the world's bounds. Water no longer stops her. */
  walkable(x: number, z: number): boolean
}

/** Water deeper than this is swum through; shallower water is waded through. */
export const SWIM_DEPTH = 0.95

export function makeLand(shape: LandShape, seed: number): Land {
  const hillNoise: Noise2 = simplex2(seed ^ 0x51ed)
  const ridgeNoise: Noise2 = simplex2(seed ^ 0x2b7a)
  const warpNoise: Noise2 = simplex2(seed ^ 0x9e37)

  const heightAt = (x: number, z: number): number => {
    // A little domain warping keeps ridges from looking like noise on a grid.
    const wx = x + warpNoise(x * 0.01, z * 0.01) * 14
    const wz = z + warpNoise(x * 0.01 + 31.7, z * 0.01 - 11.3) * 14
    let height =
      shape.base + shape.hills * fbm(hillNoise, wx * shape.hillScale, wz * shape.hillScale)
    if (shape.ridges !== 0)
      height += shape.ridges * ridged(ridgeNoise, wx * shape.ridgeScale, wz * shape.ridgeScale)
    if (shape.terrace > 0) {
      // Soft steps: flat shelves joined by short steep slopes.
      const step = height / shape.terrace
      const floor = Math.floor(step)
      const rise = smoothstep(0.55, 1, step - floor)
      height = (floor + rise) * shape.terrace
    }
    const distance = Math.sqrt(x * x + z * z)
    height += shape.rim * smoothstep(shape.rimFrom, shape.rimTo, distance)
    const flat = 1 - smoothstep(LANDING_RADIUS * 0.6, LANDING_RADIUS * 1.6, distance)
    return height + (shape.landing - height) * flat
  }

  const slopeAt = (x: number, z: number): number => {
    const e = 0.5
    const dx = heightAt(x + e, z) - heightAt(x - e, z)
    const dz = heightAt(x, z + e) - heightAt(x, z - e)
    return Math.sqrt(dx * dx + dz * dz) / (2 * e)
  }

  const swimming = (x: number, z: number): boolean =>
    shape.water !== undefined && heightAt(x, z) < shape.water - SWIM_DEPTH

  const floorAt = (x: number, z: number): number => {
    const ground = heightAt(x, z)
    return shape.water === undefined ? ground : Math.max(ground, shape.water - SWIM_DEPTH)
  }

  const walkable = (x: number, z: number): boolean => x * x + z * z <= shape.bounds * shape.bounds

  return { shape, heightAt, slopeAt, floorAt, swimming, walkable }
}
