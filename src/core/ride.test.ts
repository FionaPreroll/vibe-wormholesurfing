import { describe, expect, it } from 'vitest'
import { autopilot, holeRadius, NO_STEER, pullAt, RIDE, Ride, type RideEvent } from './ride'

function fly(ride: Ride, pilot: (ride: Ride) => { x: number; y: number }, limit = 400) {
  const events: RideEvent[] = []
  while (ride.phase !== 'done' && ride.time < limit)
    events.push(...ride.advance(1 / 60, pilot(ride)))
  return events
}

describe('Ride', () => {
  it('flies forward and counts light-years by speed', () => {
    const ride = new Ride({ seed: 1 })
    ride.advance(0.25, NO_STEER)
    expect(ride.distance).toBeGreaterThan(0)
    expect(ride.distance).toBeCloseTo(ride.time * RIDE.lightYearsPerSpeed * 1.2, 0)
  })

  it('is the same ride for the same seed and steering', () => {
    const a = new Ride({ seed: 42 })
    const b = new Ride({ seed: 42 })
    fly(a, autopilot, 30)
    fly(b, autopilot, 30)
    expect(a.distance).toBe(b.distance)
    expect(a.orbsTaken).toBe(b.orbsTaken)
    expect(a.ship).toEqual(b.ship)
  })

  it('always ends in a hole, even without any steering', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const ride = new Ride({ seed })
      const events = fly(ride, () => NO_STEER)
      expect(ride.phase).toBe('done')
      expect(ride.outcome).toBeDefined()
      expect(events.some((event) => event.type === 'enter')).toBe(true)
      expect(events.at(-1)?.type).toBe('arrive')
      // A ride left to itself is short.
      expect(ride.time).toBeLessThan(60)
    }
  })

  it('goes much farther with a pilot who collects orbs', () => {
    let idle = 0
    let piloted = 0
    for (const seed of [11, 12, 13]) {
      const lazy = new Ride({ seed })
      fly(lazy, () => NO_STEER)
      idle += lazy.distance
      const good = new Ride({ seed })
      fly(good, (ride) => autopilot(ride))
      piloted += good.distance
      expect(good.orbsTaken).toBeGreaterThan(20)
    }
    expect(piloted).toBeGreaterThan(idle * 4)
  })

  it('keeps the ship inside the field', () => {
    const ride = new Ride({ seed: 3 })
    for (let index = 0; index < 600; index++) ride.advance(1 / 60, { x: 1, y: 1 })
    expect(Math.hypot(ride.ship.x, ride.ship.y)).toBeLessThanOrEqual(RIDE.fieldRadius + 1e-9)
  })

  it('speeds up on orbs and slows down on sparks', () => {
    const ride = new Ride({ seed: 9 })
    ride.orbs.push({ id: 900, x: 0, y: 0, z: 1, taken: false })
    const before = ride.speed
    const events = ride.advance(RIDE.step * 2, NO_STEER)
    expect(events.some((event) => event.type === 'orb')).toBe(true)
    expect(ride.speed).toBeGreaterThan(before)

    const afterOrb = ride.speed
    ride.sparks.push({
      id: 901,
      x: 0,
      y: 0,
      z: 1,
      cx: 0,
      cy: 0,
      orbit: 0,
      phase: 0,
      spin: 0,
      hit: false,
    })
    const hit = ride.advance(RIDE.step * 2, NO_STEER)
    expect(hit.some((event) => event.type === 'spark')).toBe(true)
    expect(ride.speed).toBeLessThan(afterOrb - RIDE.sparkLoss / 2)
    expect(ride.stun).toBeGreaterThan(0)
  })

  it('enters a hole that the ship flies into, and arrives after the warp', () => {
    const ride = new Ride({ seed: 5 })
    ride.holes.push({ id: 77, x: 0, y: 0, z: 2, color: 'green', tier: 3, radius: holeRadius(3) })
    const events = ride.advance(0.1, NO_STEER)
    expect(events.map((event) => event.type)).toContain('enter')
    expect(ride.phase).toBe('warping')
    expect(ride.outcome).toMatchObject({ color: 'green', tier: 3 })
    const after: RideEvent[] = []
    for (let time = 0; time < RIDE.warpTime + 0.1; time += 0.1)
      after.push(...ride.advance(0.1, NO_STEER))
    expect(after.map((event) => event.type)).toContain('arrive')
    expect(ride.phase).toBe('done')
  })

  it('puts the hitbox on the tip of the nose, which leads the way as the ship moves', () => {
    const ride = new Ride({ seed: 4 })
    expect(ride.noseHitbox).toBe(true)
    expect(ride.hitbox).toEqual({ x: 0, y: 0, z: RIDE.noseReach })
    // Up and to the right: the nose turns right and tips up.
    for (let index = 0; index < 30; index++) ride.advance(1 / 60, { x: 0.6, y: 0.6 })
    const { ship, hitbox } = ride
    expect(ship.yaw).toBeGreaterThan(0)
    expect(ship.pitch).toBeGreaterThan(0)
    expect(hitbox.x).toBeGreaterThan(ship.x)
    expect(hitbox.y).toBeGreaterThan(ship.y + 0.1)
    expect(hitbox.z).toBeLessThan(RIDE.noseReach)
    expect(Math.hypot(hitbox.x - ship.x, hitbox.y - ship.y, hitbox.z)).toBeCloseTo(RIDE.noseReach)
    ride.noseHitbox = false
    expect(ride.hitbox).toEqual({ x: ship.x, y: ship.y, z: 0 })
  })

  it('meets orbs and holes with the tip of its nose, or with its middle when asked', () => {
    for (const noseHitbox of [true, false]) {
      // Within a step of the nose, but more than an orb's radius before the ship's middle.
      const orbRide = new Ride({ seed: 9, noseHitbox })
      orbRide.orbs.push({ id: 900, x: 0, y: 0, z: RIDE.noseReach + 0.5, taken: false })
      const taken = orbRide.advance(RIDE.step, NO_STEER)
      expect(taken.some((event) => event.type === 'orb')).toBe(noseHitbox)

      const holeRide = new Ride({ seed: 5, noseHitbox })
      const hole = { id: 77, x: 0, y: 0, z: RIDE.noseReach + 0.3, color: 'blue' as const }
      holeRide.holes.push({ ...hole, tier: 1, radius: holeRadius(1) })
      const entered = holeRide.advance(RIDE.step, NO_STEER)
      expect(entered.some((event) => event.type === 'enter')).toBe(noseHitbox)
      // The hole stops where it met the nose, and the warp goes on from there.
      if (noseHitbox) expect(holeRide.entered?.z).toBeCloseTo(RIDE.noseReach)
    }
  })

  it('pilots as well with the hitbox at the nose as at the middle', () => {
    for (const noseHitbox of [true, false]) {
      const ride = new Ride({ seed: 13, noseHitbox })
      fly(ride, (current) => autopilot(current))
      expect(ride.orbsTaken).toBeGreaterThan(20)
    }
  })

  it('never enters holes in a demo ride', () => {
    const ride = new Ride({ seed: 5, demo: true })
    fly(ride, () => NO_STEER, 120)
    expect(ride.phase).toBe('riding')
    expect(ride.speed).toBeGreaterThanOrEqual(1)
  })

  it('pulls harder the slower the ship flies', () => {
    expect(pullAt(RIDE.safeSpeed + 0.1)).toBe(0)
    expect(pullAt(RIDE.captureSpeed)).toBe(1)
    expect(pullAt(0.9)).toBeGreaterThan(pullAt(1.1))
  })

  it('makes rarer holes bigger', () => {
    expect(holeRadius(4)).toBeGreaterThan(holeRadius(1))
  })
})

describe('autopilot', () => {
  it('steers within the unit circle', () => {
    const ride = new Ride({ seed: 21 })
    for (let index = 0; index < 400; index++) {
      const steer = autopilot(ride)
      expect(Math.hypot(steer.x, steer.y)).toBeLessThanOrEqual(1 + 1e-9)
      ride.advance(1 / 60, steer)
    }
  })

  it('can seek a chosen hole', () => {
    const ride = new Ride({ seed: 22 })
    const hole = {
      id: 1,
      x: 5,
      y: -3,
      z: 120,
      color: 'red' as const,
      tier: 2 as const,
      radius: 2.4,
    }
    ride.holes.push(hole)
    fly(ride, (current) => autopilot(current, { seek: hole }), 10)
    expect(ride.outcome?.color).toBe('red')
  })
})

// On a 144 Hz screen the ship and the orbs juddered on the title screen: the simulation steps
// 120 times a second, so every sixth frame no step came and everything stood still for it.
describe('the lag between the simulation and the screen', () => {
  it('lets the picture move evenly on a screen with more frames than steps', () => {
    const ride = new Ride({ seed: 5, demo: true })
    for (let second = 0; second < 6 && !ride.orbs.some((orb) => orb.z > 80); second++)
      ride.advance(0.25, { x: 0, y: 0 })
    const frame = 1 / 144
    const orb = ride.orbs.reduce((far, candidate) => (candidate.z > far.z ? candidate : far))
    expect(orb.z).toBeGreaterThan(80)
    const raw: number[] = []
    const drawn: number[] = []
    let lastRaw = orb.z
    let lastDrawn = orb.z - ride.forward * ride.lag
    for (let index = 0; index < 72; index++) {
      ride.advance(frame, { x: 0, y: 0 })
      expect(ride.lag).toBeGreaterThanOrEqual(0)
      expect(ride.lag).toBeLessThan(RIDE.step)
      raw.push(lastRaw - orb.z)
      lastRaw = orb.z
      const now = orb.z - ride.forward * ride.lag
      drawn.push(lastDrawn - now)
      lastDrawn = now
    }
    const even = ride.forward * frame
    // Steps alone: some frames move nothing, some two steps' worth.
    expect(Math.min(...raw)).toBe(0)
    // Drawn ahead by the lag: every frame moves the same.
    for (const step of drawn) expect(step).toBeCloseTo(even, 2)
  })
})
