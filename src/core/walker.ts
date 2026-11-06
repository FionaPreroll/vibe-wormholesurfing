import type { Land } from './land'
import { angleDelta, damp, length2 } from './math'
import type { Blocker } from './scatter'

/** Tuning of the player on foot. */
export const WALK = {
  speed: 6.2,
  /** How fast the walk answers the stick, on the ground and in the air. */
  grip: 11,
  airGrip: 3,
  turnRate: 13,
  gravity: 32,
  jump: 11.5,
  /** The ground can drop this far under the feet and still be followed down. */
  snap: 0.6,
  /** Ground steeper than this slows the walk uphill; steeper than `wall` stops it. */
  steep: 1.1,
  wall: 2.6,
  radius: 0.45,
  /** Water slows the walk to this share. */
  wade: 0.78,
} as const

export interface WalkInput {
  /** Direction to walk in, in the world's x and z; length up to 1. */
  readonly x: number
  readonly z: number
  /** A press of jump, taken once. */
  readonly jump: boolean
}

export const STAND: WalkInput = { x: 0, z: 0, jump: false }

/** Turns tried, nearest first, when a move runs into ground that cannot be walked. */
const SLIDE_TURNS = [0.35, -0.35, 0.75, -0.75, 1.15, -1.15, 1.5, -1.5]

/**
 * The player on foot: walks, turns to face the way it goes, jumps, follows the ground, and stays
 * out of rocks, deep water and the edge of the world.
 */
export class Walker {
  x: number
  y: number
  z: number
  vx = 0
  vy = 0
  vz = 0
  /** Facing, in radians around the vertical; 0 looks along +z. */
  yaw: number
  grounded = true
  /** How fast it walks now, as a share of full speed, for the walk animation. */
  pace = 0
  /** Whether it stands in water, for splashes. */
  wading = false

  constructor(
    readonly land: Land,
    readonly blockers: readonly Blocker[],
    x = 0,
    z = 0,
    yaw = 0,
  ) {
    this.x = x
    this.z = z
    this.y = land.heightAt(x, z)
    this.yaw = yaw
  }

  step(dt: number, input: WalkInput): { jumped: boolean; landed: boolean } {
    const land = this.land
    let wantX = input.x
    let wantZ = input.z
    const lean = length2(wantX, wantZ)
    if (lean > 1) {
      wantX /= lean
      wantZ /= lean
    }
    const water = land.shape.water
    this.wading = water !== undefined && this.y < water - 0.05
    const top = WALK.speed * (this.wading ? WALK.wade : 1)
    const grip = damp(this.grounded ? WALK.grip : WALK.airGrip, dt)
    this.vx += (wantX * top - this.vx) * grip
    this.vz += (wantZ * top - this.vz) * grip

    if (lean > 0.05) {
      const target = Math.atan2(wantX, wantZ)
      this.yaw += angleDelta(this.yaw, target) * damp(WALK.turnRate, dt)
    }

    let jumped = false
    if (input.jump && this.grounded) {
      this.vy = WALK.jump
      this.grounded = false
      jumped = true
    }

    // Uphill on steep ground the walk slows, and a wall stops it. Climbing out of water is
    // always possible: the shore under water is never a wall.
    let nextX = this.x + this.vx * dt
    let nextZ = this.z + this.vz * dt
    const rise = land.heightAt(nextX, nextZ) - land.heightAt(this.x, this.z)
    const run = length2(nextX - this.x, nextZ - this.z)
    if (run > 1e-6 && this.grounded && !this.wading) {
      const slope = rise / run
      if (slope > WALK.wall) {
        nextX = this.x
        nextZ = this.z
        this.vx *= 0.2
        this.vz *= 0.2
      } else if (slope > WALK.steep) {
        const keep = 1 - (slope - WALK.steep) / (WALK.wall - WALK.steep)
        nextX = this.x + (nextX - this.x) * keep
        nextZ = this.z + (nextZ - this.z) * keep
      }
    }
    ;[nextX, nextZ] = this.#keepOut(nextX, nextZ)
    this.x = nextX
    this.z = nextZ

    this.vy -= WALK.gravity * dt
    this.y += this.vy * dt
    const ground = land.heightAt(this.x, this.z)
    let landed = false
    if (this.y <= ground) {
      landed = !this.grounded
      this.y = ground
      this.vy = 0
      this.grounded = true
    } else if (this.grounded && this.vy <= 0 && this.y - ground < WALK.snap) {
      // Walking downhill keeps the feet on the ground.
      this.y = ground
      this.vy = 0
    } else {
      this.grounded = false
    }
    this.pace = length2(this.vx, this.vz) / WALK.speed
    return { jumped, landed }
  }

  /**
   * The nearest free place to a point: outside every blocker, on walkable ground. A move that
   * would leave the walkable ground, as into deep water, turns along its edge instead, so the
   * girl slides along a shore rather than sticking to it.
   */
  #keepOut(x: number, z: number): [number, number] {
    let px = x
    let pz = z
    for (const blocker of this.blockers) {
      const dx = px - blocker.x
      const dz = pz - blocker.z
      const reach = blocker.radius + WALK.radius
      const distance = length2(dx, dz)
      if (distance < reach && distance > 1e-6) {
        px = blocker.x + (dx / distance) * reach
        pz = blocker.z + (dz / distance) * reach
      }
    }
    const land = this.land
    // Standing where one may not stand, any move is allowed, so there is always a way out.
    if (land.walkable(px, pz) || !land.walkable(this.x, this.z)) return [px, pz]
    const moveX = px - this.x
    const moveZ = pz - this.z
    const length = length2(moveX, moveZ)
    if (length > 1e-6) {
      for (const turn of SLIDE_TURNS) {
        const cos = Math.cos(turn)
        const sin = Math.sin(turn)
        const keep = Math.max(0.35, cos)
        const sx = this.x + (moveX * cos - moveZ * sin) * keep
        const sz = this.z + (moveX * sin + moveZ * cos) * keep
        if (land.walkable(sx, sz)) {
          // Carry on along the edge with the speed that is left.
          const speed = length2(this.vx, this.vz)
          this.vx = ((sx - this.x) / length) * speed
          this.vz = ((sz - this.z) / length) * speed
          return [sx, sz]
        }
      }
    }
    this.vx = 0
    this.vz = 0
    return [this.x, this.z]
  }
}
