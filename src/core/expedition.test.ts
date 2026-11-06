import { describe, expect, it } from 'vitest'
import { CAPSULE_RADIUS, Expedition, OPEN_TIME, REACH } from './expedition'
import { clearView, enclosure } from './framing'
import { length2 } from './math'
import { STAND } from './walker'
import { WORLD_IDS } from './worlds'

describe('Expedition', () => {
  it.each(WORLD_IDS)('puts the treasure of %s where the player can walk', (world) => {
    for (const seed of [1, 2, 3]) {
      const visit = new Expedition({ world, seed, tier: 2, distance: 1000, found: new Set() })
      const { treasure, walker, land } = visit
      expect(land.walkable(treasure.x, treasure.z)).toBe(true)
      expect(length2(treasure.x, treasure.z)).toBeGreaterThan(15)
      expect(land.walkable(walker.x, walker.z)).toBe(true)
      // Every blocker but the capsule's own pedestal keeps clear of the treasure.
      const scenery = visit.blockers.filter(
        (blocker) => blocker.x !== treasure.x || blocker.z !== treasure.z,
      )
      expect(scenery).toHaveLength(visit.blockers.length - 1)
      for (const blocker of scenery)
        expect(length2(treasure.x - blocker.x, treasure.z - blocker.z)).toBeGreaterThan(
          blocker.radius,
        )
    }
  })

  // A capsule once lay at the bottom of a canyon's slot, hardly seen, or against a wall that the
  // camera ran into as it opened.
  it.each(['canyon', 'cliffs', 'caverns'] as const)(
    'puts the treasure of %s on open ground that the camera can watch from several sides',
    (world) => {
      for (let seed = 1; seed <= 40; seed++) {
        const visit = new Expedition({ world, seed, tier: 1, distance: 500, found: new Set() })
        const { treasure, land, scenery, layout } = visit
        expect(enclosure(land, treasure.x, treasure.z)).toBeLessThan(0.2)
        const focus = { x: treasure.x, y: treasure.y + 1.5, z: treasure.z }
        const clear = Array.from({ length: 8 }, (_, index) => ({
          yaw: (index / 8) * Math.PI * 2,
          pitch: 0.26,
          distance: 6.4,
        })).filter((view) => clearView(land, scenery, focus, view, layout.ceiling))
        expect(clear.length).toBeGreaterThanOrEqual(4)
      }
    },
  )

  it('frames the opening treasure with nothing in the way', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const visit = new Expedition({
        world: 'canyon',
        seed,
        tier: 1,
        distance: 0,
        found: new Set(),
      })
      // The girl walks up to the treasure from where she landed.
      const { treasure, walker } = visit
      const toward = Math.atan2(walker.x - treasure.x, walker.z - treasure.z)
      walker.x = treasure.x + Math.sin(toward) * 2
      walker.z = treasure.z + Math.cos(toward) * 2
      walker.y = visit.land.heightAt(walker.x, walker.z)
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const view = visit.revealView(yaw)
        expect(clearView(visit.land, visit.scenery, view.focus, view, visit.layout.ceiling)).toBe(
          true,
        )
      }
    }
  })

  it('is the same world for the same seed', () => {
    const a = new Expedition({ world: 'canyon', seed: 8, tier: 1, distance: 0, found: new Set() })
    const b = new Expedition({ world: 'canyon', seed: 8, tier: 1, distance: 0, found: new Set() })
    expect(a.treasure).toEqual(b.treasure)
    expect(a.props.length).toBe(b.props.length)
    expect(a.reward).toEqual(b.reward)
  })

  it('walks to the treasure, opens it and reveals the reward', () => {
    const visit = new Expedition({
      world: 'cliffs',
      seed: 4,
      tier: 3,
      distance: 0,
      found: new Set(),
    })
    // Carry the player next to the treasure, as a walk there would.
    visit.walker.x = visit.treasure.x + REACH / 2
    visit.walker.z = visit.treasure.z
    visit.walker.y = visit.land.heightAt(visit.walker.x, visit.walker.z)
    expect(visit.canOpen).toBe(true)
    const opened = visit.step(1 / 60, STAND, true)
    expect(opened).toEqual([{ type: 'open' }])
    expect(visit.phase).toBe('opening')
    const events = []
    for (let time = 0; time < OPEN_TIME + 0.2; time += 1 / 60)
      events.push(...visit.step(1 / 60, STAND, false))
    expect(events).toContainEqual({ type: 'reveal', reward: visit.reward })
    expect(visit.phase).toBe('revealed')
  })

  it('does not open from afar', () => {
    const visit = new Expedition({
      world: 'lagoon',
      seed: 4,
      tier: 1,
      distance: 0,
      found: new Set(),
    })
    expect(visit.canOpen).toBe(false)
    expect(visit.step(1 / 60, STAND, true)).toEqual([])
    expect(visit.phase).toBe('exploring')
  })
})

describe('the treasure capsule', () => {
  it('cannot be walked into', () => {
    const visit = new Expedition({
      world: 'canyon',
      seed: 6,
      tier: 2,
      distance: 0,
      found: new Set(),
    })
    const { treasure, walker } = visit
    walker.x = treasure.x + 4
    walker.z = treasure.z
    walker.y = visit.land.floorAt(walker.x, walker.z)
    for (let index = 0; index < 120; index++)
      visit.step(1 / 60, { x: -1, z: 0, jump: false }, false)
    expect(Math.hypot(walker.x - treasure.x, walker.z - treasure.z)).toBeGreaterThanOrEqual(
      CAPSULE_RADIUS,
    )
    expect(visit.canOpen).toBe(true)
  })
})
