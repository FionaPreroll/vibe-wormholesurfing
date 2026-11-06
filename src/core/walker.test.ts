import { describe, expect, it } from 'vitest'
import { makeLand } from './land'
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
