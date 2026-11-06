import { describe, expect, it } from 'vitest'
import { clearView, enclosure, revealView, viewFrom } from './framing'
import type { Land } from './land'

/** A made-up world: ground by a function, nothing else. */
function landOf(heightAt: (x: number, z: number) => number): Land {
  return {
    shape: { bounds: 60 } as Land['shape'],
    heightAt,
    slopeAt: () => 0,
    floorAt: heightAt,
    swimming: () => false,
    walkable: () => true,
  }
}

const flat = landOf(() => 0)
/** A wall along the treasure's right, where the camera likes to stand. */
const wallRight = landOf((x) => (x > 2 ? 12 : 0))
const girl = { x: 0, y: 0, z: -1.2 }
const treasure = { x: 0, z: 1.2 }

describe('clearView', () => {
  const focus = { x: 0, y: 1.5, z: 0 }
  const side = { yaw: Math.PI / 2, pitch: 0.26, distance: 6.4 }

  it('sees across open ground', () => {
    expect(clearView(flat, [], focus, side)).toBe(true)
  })

  it('does not see through a wall, nor stand inside one', () => {
    expect(clearView(wallRight, [], focus, side)).toBe(false)
    expect(clearView(wallRight, [], focus, { ...side, yaw: -Math.PI / 2 })).toBe(true)
  })

  it('does not see through scenery, but over it', () => {
    const rock = { x: 3, z: 0, radius: 0.8 }
    expect(clearView(flat, [rock], focus, side)).toBe(false)
    expect(clearView(flat, [rock], focus, { ...side, pitch: 1.2 })).toBe(true)
  })

  it('keeps under a ceiling', () => {
    expect(clearView(flat, [], focus, { ...side, pitch: 1.2 }, 5)).toBe(false)
  })
})

describe('revealView', () => {
  it('watches the treasure from the side nearer the camera on open ground', () => {
    const view = revealView(flat, [], girl, treasure, Math.PI / 2 - 0.3)
    expect(view.yaw).toBeCloseTo(Math.PI / 2)
    expect(view.pitch).toBeCloseTo(0.26)
    // Between the girl and the treasure, nearer the treasure.
    expect(view.focus.z).toBeGreaterThan(0)
  })

  it('turns to the clear side where a wall stands on the nearer one', () => {
    // The camera stood on the wall's side; it does not push into the wall.
    const view = revealView(wallRight, [], girl, treasure, Math.PI / 2)
    expect(viewFrom(view.focus, view).x).toBeLessThan(0)
    expect(clearView(wallRight, [], view.focus, view)).toBe(true)
  })

  it('rises over a slot too narrow to watch from the side', () => {
    const slot = landOf((x) => (Math.abs(x) > 2 ? 2.4 : 0))
    const view = revealView(slot, [], girl, treasure, Math.PI / 2)
    expect(clearView(slot, [], view.focus, view)).toBe(true)
  })
})

describe('enclosure', () => {
  it('is nothing on open ground, and much in a hollow', () => {
    expect(enclosure(flat, 0, 0)).toBe(0)
    const hollow = landOf((x, z) => Math.min(8, Math.hypot(x, z) * 1.5))
    expect(enclosure(hollow, 0, 0)).toBeGreaterThan(0.9)
    expect(enclosure(wallRight, 1, 0)).toBeGreaterThan(0.2)
  })
})
