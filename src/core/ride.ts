import { DISTANCE_CAP, type HoleColor, type HoleTier, rollHole } from './holes'
import { clamp, clamp01, damp, length2 } from './math'
import { between, inDisc, type Random, seededRandom } from './random'

/**
 * The tuning of a ride. Space is a straight tunnel: the ship moves across a disc of the tunnel's
 * cross-section (x to the right, y up), and everything else comes toward it along z, the distance
 * ahead of the ship. The view bends the tunnel for the eye only.
 */
export const RIDE = {
  /** Fixed step of the simulation in seconds. */
  step: 1 / 120,
  /** The ship stays within this radius of the tunnel's middle. */
  fieldRadius: 7,
  /** Where orbs and sparks appear ahead, and where holes appear. */
  spawnDistance: 300,
  holeSpawnDistance: 430,
  /** Things this far behind the ship are gone. */
  despawnDistance: -30,
  /** Units per second flown forward at speed 1, and light-years per second. */
  unitsPerSpeed: 62,
  lightYearsPerSpeed: 55,
  startSpeed: 1.2,
  minSpeed: 0.25,
  maxSpeed: 2.6,
  /** Speed lost per second, and how much more per thousand light-years. */
  decay: 0.03,
  decayPerThousand: 0.007,
  /** Speed an orb gives, and a little more for each orb in a quick chain. */
  orbBoost: 0.07,
  comboBoost: 0.012,
  maxCombo: 8,
  comboWindow: 1.4,
  /** Speed a spark takes, how long it stuns and how long the ship cannot be hit again. */
  sparkLoss: 0.22,
  stunTime: 0.7,
  shieldTime: 1.2,
  /** Orb groups and sparks per second. Orbs grow scarce with distance and stop at `orbStop`. */
  orbGroupRate: 1.1,
  orbStop: 6000,
  sparkRate: 0.55,
  sparkRateAtCap: 1.3,
  /** Seconds before the first hole, and between holes. */
  firstHole: 5,
  holeInterval: [3.4, 6] as const,
  pairChance: 0.3,
  /** Sideways speed at full lean, and how fast the ship answers the controls. */
  maxLateral: 13,
  response: 7.5,
  shipRadius: 0.85,
  orbRadius: 0.8,
  sparkRadius: 0.75,
  /**
   * Holes pull at the ship below `safeSpeed`, harder the slower it is. Below `captureSpeed` the
   * next hole takes it whatever the controls say.
   */
  safeSpeed: 1.2,
  captureSpeed: 0.55,
  pullRange: 110,
  pullAccel: 46,
  /** Seconds from entering a hole to arriving in its world. */
  warpTime: 1.8,
} as const

export interface Steer {
  /** Right is positive; the length of (x, y) is at most 1. */
  readonly x: number
  /** Up is positive. */
  readonly y: number
}

export const NO_STEER: Steer = { x: 0, y: 0 }

export interface Ship {
  x: number
  y: number
  vx: number
  vy: number
}

export interface Orb {
  readonly id: number
  readonly x: number
  readonly y: number
  z: number
  taken: boolean
}

export interface Spark {
  readonly id: number
  x: number
  y: number
  z: number
  /** The spark circles around this point. */
  readonly cx: number
  readonly cy: number
  readonly orbit: number
  readonly phase: number
  readonly spin: number
  hit: boolean
}

export interface Hole {
  readonly id: number
  readonly x: number
  readonly y: number
  z: number
  readonly color: HoleColor
  readonly tier: HoleTier
  readonly radius: number
}

export type RideEvent =
  | { readonly type: 'orb'; readonly orb: Orb; readonly combo: number }
  | { readonly type: 'spark'; readonly spark: Spark }
  | { readonly type: 'hole'; readonly hole: Hole }
  | { readonly type: 'captured'; readonly hole: Hole }
  | { readonly type: 'enter'; readonly hole: Hole }
  | { readonly type: 'arrive'; readonly hole: Hole }

export type RidePhase = 'riding' | 'warping' | 'done'

export interface RideOutcome {
  readonly color: HoleColor
  readonly tier: HoleTier
  readonly distance: number
}

export interface RideOptions {
  readonly seed: number
  /**
   * A ride for the title screen: holes pass by without pulling, and the speed holds, so the
   * ride goes on for as long as it is shown.
   */
  readonly demo?: boolean
}

/** A hole's size grows with its tier. */
export function holeRadius(tier: HoleTier): number {
  return 2.4 + tier * 0.3
}

/** How hard holes pull at a speed: 0 when safe, 1 at the capture speed and below. */
export function pullAt(speed: number): number {
  return clamp01((RIDE.safeSpeed - speed) / (RIDE.safeSpeed - RIDE.captureSpeed))
}

/**
 * One ride through the wormhole: collect orbs for speed, dodge sparks, and pick a warp hole
 * before the speed runs out and a hole picks the ship. Feed it time and steering with `advance`.
 */
export class Ride {
  readonly seed: number
  readonly demo: boolean
  readonly ship: Ship = { x: 0, y: 0, vx: 0, vy: 0 }
  readonly orbs: Orb[] = []
  readonly sparks: Spark[] = []
  readonly holes: Hole[] = []
  phase: RidePhase = 'riding'
  /** Seconds since the start. */
  time = 0
  /** Light-years flown. */
  distance = 0
  speed: number = RIDE.startSpeed
  /** Orbs taken in a quick chain, and seconds left to keep it going. */
  combo = 0
  comboTimer = 0
  /** Seconds the ship stays stunned, and shielded from more sparks. */
  stun = 0
  shield = 0
  orbsTaken = 0
  sparksHit = 0
  /** The hole that has the ship in its grip, or that it entered. */
  captured: Hole | undefined
  entered: Hole | undefined
  /** Seconds since the ship entered its hole. */
  warp = 0

  readonly #random: Random
  #accumulator = 0
  #nextId = 1
  #nextOrbs = 1.2
  #nextSpark = 2.5
  #nextHole: number = RIDE.firstHole
  #events: RideEvent[] = []

  constructor({ seed, demo = false }: RideOptions) {
    this.seed = seed
    this.demo = demo
    this.#random = seededRandom(seed)
    if (demo) this.speed = 1.3
  }

  /** Forward speed in units per second. */
  get forward(): number {
    return this.speed * RIDE.unitsPerSpeed
  }

  /** How hard holes pull at the ship now, from 0 to 1. */
  get pull(): number {
    return this.demo ? 0 : pullAt(this.speed)
  }

  /** Where the ride led, once the ship has entered a hole. */
  get outcome(): RideOutcome | undefined {
    const hole = this.entered
    return hole && { color: hole.color, tier: hole.tier, distance: Math.floor(this.distance) }
  }

  /** Lets `seconds` pass in fixed steps and returns what happened meanwhile. */
  advance(seconds: number, steer: Steer): RideEvent[] {
    // A long stall, as when the tab was hidden, does not fast-forward the ride.
    this.#accumulator += Math.min(seconds, 0.25)
    while (this.#accumulator >= RIDE.step) {
      this.#accumulator -= RIDE.step
      this.step(steer)
    }
    const events = this.#events
    this.#events = []
    return events
  }

  /** One fixed step of the simulation. Events collect until the next `advance` returns. */
  step(steer: Steer): void {
    if (this.phase === 'done') return
    const dt = RIDE.step
    this.time += dt
    if (this.phase === 'warping') {
      this.#warpStep(dt)
      return
    }

    this.#updateSpeed(dt)
    this.#steerShip(steer, dt)
    this.#moveWorld(dt)
    this.#collide()
    if (this.phase !== 'riding') return
    this.#checkCapture()
    this.#spawn()
  }

  #emit(event: RideEvent): void {
    this.#events.push(event)
  }

  #updateSpeed(dt: number): void {
    if (this.demo) {
      this.speed = clamp(this.speed - (this.speed - 1.3) * dt * 0.3, 1, 2)
    } else {
      const decay = RIDE.decay + (RIDE.decayPerThousand * this.distance) / 1000
      this.speed = Math.max(RIDE.minSpeed, this.speed - decay * dt)
    }
    this.stun = Math.max(0, this.stun - dt)
    this.shield = Math.max(0, this.shield - dt)
    this.comboTimer -= dt
    if (this.comboTimer <= 0) this.combo = 0
  }

  #steerShip(steer: Steer, dt: number): void {
    const ship = this.ship
    const lean = Math.min(1, length2(steer.x, steer.y))
    const scale = lean > 0 ? lean / length2(steer.x, steer.y) : 0
    const control = this.stun > 0 ? 0.3 : 1
    const targetX = steer.x * scale * RIDE.maxLateral * control
    const targetY = steer.y * scale * RIDE.maxLateral * control
    const answer = damp(RIDE.response, dt)
    const hole = this.captured
    if (hole) {
      // In a hole's grip the controls do nothing: the ship falls toward the middle of the hole,
      // arriving there as the hole reaches it.
      const timeLeft = Math.max(0.12, hole.z / Math.max(1, this.forward))
      const wantX = (hole.x - ship.x) / timeLeft
      const wantY = (hole.y - ship.y) / timeLeft
      const grip = damp(9, dt)
      ship.vx += (wantX - ship.vx) * grip
      ship.vy += (wantY - ship.vy) * grip
    } else {
      ship.vx += (targetX - ship.vx) * answer
      ship.vy += (targetY - ship.vy) * answer
      const pull = this.pull
      if (pull > 0) {
        for (const near of this.holes) {
          if (near.z <= 0 || near.z > RIDE.pullRange) continue
          const dx = near.x - ship.x
          const dy = near.y - ship.y
          const distance = Math.max(0.001, length2(dx, dy))
          const strength =
            (RIDE.pullAccel * pull * (1 - near.z / RIDE.pullRange)) / (1 + (distance / 5) ** 2)
          ship.vx += (dx / distance) * strength * dt
          ship.vy += (dy / distance) * strength * dt
        }
      }
    }
    ship.x += ship.vx * dt
    ship.y += ship.vy * dt
    const radius = length2(ship.x, ship.y)
    if (radius > RIDE.fieldRadius) {
      // The edge of the field holds the ship softly: it slides along instead of stopping dead.
      const nx = ship.x / radius
      const ny = ship.y / radius
      ship.x = nx * RIDE.fieldRadius
      ship.y = ny * RIDE.fieldRadius
      const outward = ship.vx * nx + ship.vy * ny
      if (outward > 0) {
        ship.vx -= outward * nx
        ship.vy -= outward * ny
      }
    }
  }

  #moveWorld(dt: number): void {
    const travel = this.forward * dt
    this.distance += this.speed * RIDE.lightYearsPerSpeed * dt
    for (const orb of this.orbs) orb.z -= travel
    for (const spark of this.sparks) {
      spark.z -= travel
      const angle = spark.phase + this.time * spark.spin
      spark.x = spark.cx + Math.cos(angle) * spark.orbit
      spark.y = spark.cy + Math.sin(angle) * spark.orbit
    }
    for (const hole of this.holes) hole.z -= travel
    const gone = (thing: { z: number }) => thing.z < RIDE.despawnDistance
    removeWhere(this.orbs, gone)
    removeWhere(this.sparks, gone)
    removeWhere(this.holes, gone)
  }

  #collide(): void {
    const ship = this.ship
    const travel = this.forward * RIDE.step
    // Things move several units per step at speed, so each test covers the whole step's path.
    const crossed = (z: number, reach: number) => z <= reach && z + travel >= -reach
    for (const orb of this.orbs) {
      if (orb.taken || !crossed(orb.z, RIDE.orbRadius)) continue
      if (length2(orb.x - ship.x, orb.y - ship.y) > RIDE.shipRadius + RIDE.orbRadius) continue
      orb.taken = true
      this.orbsTaken++
      this.combo = Math.min(RIDE.maxCombo, this.combo + 1)
      this.comboTimer = RIDE.comboWindow
      this.speed = Math.min(
        RIDE.maxSpeed,
        this.speed + RIDE.orbBoost + RIDE.comboBoost * (this.combo - 1),
      )
      this.#emit({ type: 'orb', orb, combo: this.combo })
    }
    for (const spark of this.sparks) {
      if (spark.hit || this.shield > 0 || !crossed(spark.z, RIDE.sparkRadius)) continue
      if (length2(spark.x - ship.x, spark.y - ship.y) > RIDE.shipRadius + RIDE.sparkRadius) continue
      spark.hit = true
      this.sparksHit++
      this.stun = RIDE.stunTime
      this.shield = RIDE.shieldTime
      this.combo = 0
      this.speed = Math.max(RIDE.minSpeed, this.speed - RIDE.sparkLoss)
      this.#emit({ type: 'spark', spark })
    }
    if (this.demo) return
    for (const hole of this.holes) {
      if (hole.z > 0 || hole.z + travel < 0) continue
      const inside = length2(hole.x - ship.x, hole.y - ship.y) < hole.radius * 0.8
      if (inside || hole === this.captured) {
        this.#enter(hole)
        return
      }
    }
  }

  #enter(hole: Hole): void {
    this.phase = 'warping'
    this.entered = hole
    this.captured = undefined
    this.warp = 0
    hole.z = 0
    this.#emit({ type: 'enter', hole })
  }

  #warpStep(dt: number): void {
    const hole = this.entered
    if (!hole) return
    this.warp += dt
    // The ship glides into the middle of the hole while the rest of space rushes on.
    const ship = this.ship
    const glide = damp(5, dt)
    ship.x += (hole.x - ship.x) * glide
    ship.y += (hole.y - ship.y) * glide
    ship.vx = 0
    ship.vy = 0
    for (const orb of this.orbs) orb.z -= this.forward * dt
    for (const spark of this.sparks) spark.z -= this.forward * dt
    if (this.warp >= RIDE.warpTime) {
      this.phase = 'done'
      this.#emit({ type: 'arrive', hole })
    }
  }

  #checkCapture(): void {
    if (this.demo || this.captured || this.speed >= RIDE.captureSpeed) return
    const soonest = this.forward * 0.6
    const ahead = this.holes
      .filter((hole) => hole.z > soonest && hole.z < RIDE.holeSpawnDistance)
      .sort((a, b) => a.z - b.z)[0]
    const hole = ahead ?? this.#spawnHoleNear(this.ship.x, this.ship.y, Math.max(60, soonest * 3))
    this.captured = hole
    this.#emit({ type: 'captured', hole })
  }

  #spawn(): void {
    const random = this.#random
    if (this.time >= this.#nextOrbs) {
      const rate = RIDE.orbGroupRate * clamp01(1 - this.distance / RIDE.orbStop)
      if (rate > 0.02) {
        this.#spawnOrbs()
        this.#nextOrbs = this.time + (0.5 + random()) / rate
      } else {
        this.#nextOrbs = this.time + 1
      }
    }
    if (this.time >= this.#nextSpark) {
      const progress = clamp01(this.distance / DISTANCE_CAP)
      const rate = RIDE.sparkRate + (RIDE.sparkRateAtCap - RIDE.sparkRate) * progress
      this.#spawnSpark()
      this.#nextSpark = this.time + (0.5 + random()) / rate
    }
    if (this.time >= this.#nextHole && !this.captured) {
      const first = this.#spawnHole()
      if (random() < RIDE.pairChance) this.#spawnHole(first)
      const [min, max] = RIDE.holeInterval
      this.#nextHole = this.time + between(random, min, max)
    }
  }

  #spawnOrbs(): void {
    const random = this.#random
    const z = RIDE.spawnDistance
    const pattern = random()
    if (pattern < 0.45) {
      const at = inDisc(random, RIDE.fieldRadius - 1)
      this.#addOrb(at.x, at.y, z)
    } else if (pattern < 0.8) {
      // A trail that sweeps across the tunnel, to be followed in one smooth lean.
      const from = inDisc(random, RIDE.fieldRadius - 1.5)
      const to = inDisc(random, RIDE.fieldRadius - 1.5)
      const count = 3 + Math.floor(random() * 3)
      for (let index = 0; index < count; index++) {
        const amount = index / (count - 1)
        this.#addOrb(
          from.x + (to.x - from.x) * amount * 0.6,
          from.y + (to.y - from.y) * amount * 0.6,
          z + index * 9,
        )
      }
    } else {
      // An arc around a point: a swing of the ship takes the whole arc.
      const center = inDisc(random, RIDE.fieldRadius - 3)
      const start = random() * Math.PI * 2
      const turn = random() < 0.5 ? 1 : -1
      for (let index = 0; index < 5; index++) {
        const angle = start + turn * index * 0.55
        this.#addOrb(
          center.x + Math.cos(angle) * 2.4,
          center.y + Math.sin(angle) * 2.4,
          z + index * 7,
        )
      }
    }
  }

  #addOrb(x: number, y: number, z: number): void {
    const radius = length2(x, y)
    const limit = RIDE.fieldRadius - 0.5
    const scale = radius > limit ? limit / radius : 1
    this.orbs.push({ id: this.#nextId++, x: x * scale, y: y * scale, z, taken: false })
  }

  #spawnSpark(): void {
    const random = this.#random
    const center = inDisc(random, RIDE.fieldRadius - 1)
    const orbit = random() < 0.5 ? 0 : between(random, 0.6, 1.8)
    this.sparks.push({
      id: this.#nextId++,
      x: center.x,
      y: center.y,
      z: RIDE.spawnDistance,
      cx: center.x,
      cy: center.y,
      orbit,
      phase: random() * Math.PI * 2,
      spin: between(random, 0.8, 2) * (random() < 0.5 ? -1 : 1),
      hit: false,
    })
  }

  /** A new hole, away from `other` when it comes as a pair. */
  #spawnHole(other?: Hole): Hole {
    const random = this.#random
    let at = inDisc(random, RIDE.fieldRadius - 1.5)
    for (let tries = 0; other && tries < 12; tries++) {
      if (length2(at.x - other.x, at.y - other.y) > 6) break
      at = inDisc(random, RIDE.fieldRadius - 1.5)
    }
    return this.#addHole(at.x, at.y, RIDE.holeSpawnDistance + (other ? 25 : 0))
  }

  #spawnHoleNear(x: number, y: number, z: number): Hole {
    const random = this.#random
    const offset = inDisc(random, 2)
    return this.#addHole(x + offset.x, y + offset.y, z)
  }

  #addHole(x: number, y: number, z: number): Hole {
    const kind = rollHole(this.#random, this.distance)
    const radius = length2(x, y)
    const limit = RIDE.fieldRadius - 1
    const scale = radius > limit ? limit / radius : 1
    const hole: Hole = {
      id: this.#nextId++,
      x: x * scale,
      y: y * scale,
      z,
      color: kind.color,
      tier: kind.tier,
      radius: holeRadius(kind.tier),
    }
    this.holes.push(hole)
    this.#emit({ type: 'hole', hole })
    return hole
  }
}

function removeWhere<T>(list: T[], test: (item: T) => boolean): void {
  let write = 0
  for (const item of list) if (!test(item)) list[write++] = item
  list.length = write
}

export interface AutopilotOptions {
  /** Steer clear of holes, as the title screen's ride does. */
  readonly avoidHoles?: boolean
  /** A hole to fly into, once the pilot wants to land. */
  readonly seek?: Hole
}

/**
 * A pilot that chases orbs and dodges sparks: it flies the title screen's ride and lets tests
 * fly real rides.
 */
export function autopilot(ride: Ride, { avoidHoles = true, seek }: AutopilotOptions = {}): Steer {
  const ship = ride.ship
  const forward = Math.max(1, ride.forward)
  let wantX = 0
  let wantY = 0
  if (seek && seek.z > 0) {
    const time = Math.max(0.2, seek.z / forward)
    wantX = (seek.x - ship.x) / time
    wantY = (seek.y - ship.y) / time
  } else {
    let best: Orb | undefined
    let bestScore = Number.POSITIVE_INFINITY
    for (const orb of ride.orbs) {
      if (orb.taken || orb.z < 2 || orb.z > 160) continue
      const time = orb.z / forward
      const reach = length2(orb.x - ship.x, orb.y - ship.y) / (RIDE.maxLateral * 0.8)
      if (reach > time) continue
      const score = orb.z + reach * 30
      if (score < bestScore) {
        bestScore = score
        best = orb
      }
    }
    if (best) {
      const time = Math.max(0.15, best.z / forward)
      wantX = (best.x - ship.x) / time
      wantY = (best.y - ship.y) / time
    } else {
      wantX = -ship.x * 0.5
      wantY = -ship.y * 0.5
    }
  }
  const dodge = (x: number, y: number, z: number, room: number, push: number) => {
    if (z < -1 || z > 70) return
    const dx = ship.x - x
    const dy = ship.y - y
    const distance = Math.max(0.01, length2(dx, dy))
    if (distance > room) return
    const strength = push * (1 - distance / room) * (1 - z / 80)
    wantX += (dx / distance) * strength
    wantY += (dy / distance) * strength
  }
  for (const spark of ride.sparks) if (!spark.hit) dodge(spark.x, spark.y, spark.z, 3.2, 40)
  if (avoidHoles && !seek)
    for (const hole of ride.holes) dodge(hole.x, hole.y, hole.z, hole.radius + 2.5, 45)
  const x = wantX / RIDE.maxLateral
  const y = wantY / RIDE.maxLateral
  const lean = length2(x, y)
  return lean > 1 ? { x: x / lean, y: y / lean } : { x, y }
}
