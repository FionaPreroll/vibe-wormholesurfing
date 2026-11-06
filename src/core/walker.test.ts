import { describe, expect, it } from 'vitest'
import { makeLand, SWIM_DEPTH } from './land'
import { LAYOUTS } from './layouts'
import { STAND, WALK, Walker } from './walker'

const land = makeLand(LAYOUTS.canyon.land, 1)

describe('Walker', () => {
  it('walks in the direction asked and turns to face it', () => {
    const walker = new Walker(land, [], 0, 0, 0)
    for (let index = 0; index < 60; index++) walker.step(1 / 60, { x: 1, z: 0, jump: false })
    expect(walker.x).toBeGreaterThan(3)
    expect(Math.abs(walker.z)).toBeLessThan(0.5)
    expect(walker.yaw).toBeCloseTo(Math.PI / 2, 1)
  })

  it('stands on the ground and comes back down after a jump', () => {
    const walker = new Walker(land, [], 0, 0)
    const ground = land.heightAt(0, 0)
    expect(walker.y).toBeCloseTo(ground)
    const first = walker.step(1 / 60, { x: 0, z: 0, jump: true })
    expect(first.jumped).toBe(true)
    let peak = walker.y
    let landed = false
    for (let index = 0; index < 120; index++) {
      landed ||= walker.step(1 / 60, STAND).landed
      peak = Math.max(peak, walker.y)
    }
    expect(peak).toBeGreaterThan(ground + 1.5)
    expect(landed).toBe(true)
    expect(walker.y).toBeCloseTo(land.heightAt(walker.x, walker.z))
  })

  it('cannot walk through a blocker', () => {
    const walker = new Walker(land, [{ x: 3, z: 0, radius: 1 }], 0, 0)
    for (let index = 0; index < 120; index++) walker.step(1 / 60, { x: 1, z: 0, jump: false })
    expect(walker.x).toBeLessThanOrEqual(3 - 1 - WALK.radius + 1e-6)
  })

  it('stays inside the bounds of the world', () => {
    const walker = new Walker(land, [], 0, 0)
    for (let index = 0; index < 60 * 30; index++) walker.step(1 / 60, { x: 0, z: 1, jump: false })
    expect(Math.hypot(walker.x, walker.z)).toBeLessThanOrEqual(LAYOUTS.canyon.land.bounds)
  })
})

describe('Walker in water', () => {
  const lagoon = makeLand(LAYOUTS.lagoon.land, 3)
  const water = LAYOUTS.lagoon.land.water ?? 0

  /** A walkable spot in shallow water with deep water a few steps to one side. */
  function shoreSpot(): { x: number; z: number; toward: number } {
    for (let x = -60; x < 60; x += 1.5) {
      for (let z = -60; z < 60; z += 1.5) {
        if (!lagoon.walkable(x, z) || lagoon.heightAt(x, z) > water - 0.2) continue
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          if (!lagoon.walkable(x + Math.sin(angle) * 2, z + Math.cos(angle) * 2))
            return { x, z, toward: angle }
        }
      }
    }
    throw new Error('the lagoon has no shore')
  }

  it('swims across deep water, floating at the surface', () => {
    const spot = shoreSpot()
    const walker = new Walker(lagoon, [], spot.x, spot.z)
    for (let index = 0; index < 120; index++)
      walker.step(1 / 60, { x: Math.sin(spot.toward), z: Math.cos(spot.toward), jump: false })
    expect(Math.hypot(walker.x - spot.x, walker.z - spot.z)).toBeGreaterThan(5)
    if (lagoon.swimming(walker.x, walker.z)) {
      expect(walker.swimming).toBe(true)
      expect(walker.y).toBeCloseTo(water - SWIM_DEPTH, 1)
    }
  })

  it('walks out of the water the way it came', () => {
    const spot = shoreSpot()
    const walker = new Walker(lagoon, [], spot.x, spot.z)
    const away = spot.toward + Math.PI
    for (let index = 0; index < 180; index++)
      walker.step(1 / 60, { x: Math.sin(away), z: Math.cos(away), jump: false })
    expect(Math.hypot(walker.x - spot.x, walker.z - spot.z)).toBeGreaterThan(5)
  })
})
