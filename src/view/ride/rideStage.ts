import * as THREE from 'three'
import { approach, clamp, damp } from '../../core/math'
import { autopilot, type Hole, RIDE, Ride, type RideEvent, type RideOutcome } from '../../core/ride'
import { emit } from '../../game/events'
import { nextRideHud, rideFeel, rideHud } from '../../game/hud'
import { settings } from '../../game/settings'
import type { ControlFrame } from '../../input/input'
import { applyFov, type Stage } from '../engine'
import { spaceEnvironment } from '../environments'
import { buildGirl, type GirlRig } from '../models/girl'
import { buildShip, type ShipRig } from '../models/ship'
import { disposeMaterials } from '../models/toon'
import { defaultLook, type Look } from '../post'
import type { QualityLevel } from '../quality'
import { uniform } from '../uniforms'
import { bendAt, bendFor } from './bend'
import { Ghost, LIGHT_ORDER } from './ghost'
import { Hitboxes } from './hitboxes'
import { Bursts, buildDust, buildStreaks } from './particles'
import { Shards } from './shards'
import { HOLE_LIGHT, HoleView, ThingKit } from './things'
import { Trail } from './trail'
import { buildTunnel, type RideUniforms, rideUniforms } from './tunnel'

export interface RideStageOptions {
  readonly seed: number
  readonly level: QualityLevel
  /** The title screen's ride: an autopilot flies and the camera circles the ship. */
  readonly demo?: boolean
  readonly reducedMotion?: () => boolean
  /**
   * Called as the ship enters a hole, when the outcome is settled: the world behind it can be
   * made ready while the warp plays.
   */
  readonly onEnter?: (outcome: RideOutcome) => void
  /** Called once the ship has gone through a hole. */
  readonly onArrive?: (outcome: RideOutcome) => void
  /** The player asked to pause. */
  readonly onPause?: () => void
  /** The player asked to set the tilt's straight ahead. */
  readonly onRecenter?: () => void
}

const ORB_COLOR = new THREE.Color(1.0, 0.7, 0.3)
const SPARK_COLOR = new THREE.Color(0.55, 0.75, 1.0)

/** How much of the ship shows in a ride: enough to steer by, little enough to see ahead. */
const SHIP_OPACITY = 0.62
/**
 * Where an automatic choice makes the ship see-through: its depth pass and blending cost a phone
 * about a fifth of the draw calls of a ride (Settings → See-through ship).
 */
const SEE_THROUGH_LEVELS: ReadonlySet<string> = new Set(['high', 'ultra'])

/**
 * The ride through the wormhole: the simulation from `src/core/ride.ts`, drawn as a swirling
 * tunnel with the ship and the girl, orbs, sparks and warp holes.
 */
export class RideStage implements Stage {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 1400)
  readonly look: Look = defaultLook()
  readonly ride: Ride

  readonly #options: RideStageOptions
  readonly #uniforms: RideUniforms
  readonly #ship: ShipRig
  readonly #girl: GirlRig
  /** The ship and its pilot, see-through in a ride so the way ahead shows. */
  readonly #ghost: Ghost
  /**
   * One of everything that comes along only later in a ride: an orb, a spark and the rarest
   * hole, with its halos and flower. They are in the scene while the stage compiles, so their
   * shaders compile with it, and hidden before it draws; they stay in it, so their materials
   * keep the programs alive for the orbs, sparks and holes to come.
   */
  readonly #samples = new THREE.Group()
  /** The rules' circles, drawn when the debug setting asks for them. */
  readonly #hitboxes = new Hitboxes()
  #see = 1
  readonly #kit = new ThingKit()
  readonly #orbs = new Map<number, THREE.Group>()
  readonly #orbPool: THREE.Group[] = []
  readonly #sparks = new Map<number, ReturnType<ThingKit['makeSpark']>>()
  readonly #sparkPool: ReturnType<ThingKit['makeSpark']>[] = []
  readonly #holes = new Map<number, HoleView>()
  readonly #bursts: Bursts
  readonly #shards: Shards
  readonly #trails: Trail[]
  readonly #flashLight: THREE.PointLight
  readonly #bend = new THREE.Vector2()
  readonly #offset = new THREE.Vector2()
  readonly #cameraTarget = new THREE.Vector3()
  readonly #lookTarget = new THREE.Vector3(0, 0, -20)
  readonly #lookNow = new THREE.Vector3(0, 0, -20)
  #time = 0
  #travel = 0
  /** When the HUD last changed, in `performance.now()` time. */
  #hudShownAt = Number.NEGATIVE_INFINITY
  /** Where the ship is drawn, a fraction of a step past where the simulation has it. */
  #shipX = 0
  #shipY = 0
  /** How much nearer things are drawn than the simulation has them, for the same reason. */
  #ahead = 0
  #bank = 0
  #pitch = 0
  #shake = 0
  #flash = 0
  #kick = 0
  #hurt = 0
  #arrived = false

  constructor(renderer: THREE.WebGLRenderer, options: RideStageOptions) {
    this.#options = options
    this.ride = new Ride({ seed: options.seed, demo: options.demo })
    this.#uniforms = rideUniforms()
    const level = options.level
    const scene = this.scene
    scene.background = new THREE.Color().setRGB(0.02, 0.024, 0.1, THREE.LinearSRGBColorSpace)
    scene.environment = spaceEnvironment(renderer)
    scene.environmentIntensity = 0.55
    scene.add(buildTunnel(this.#uniforms))
    scene.add(buildDust(this.#uniforms, Math.round(2600 * level.detail)))
    scene.add(buildStreaks(this.#uniforms, Math.round(260 * level.detail)))
    this.#shards = new Shards(Math.round(70 * level.detail))
    scene.add(this.#shards.mesh)
    this.#bursts = new Bursts(900)
    this.#bursts.setPixelRatio(renderer.getPixelRatio())
    // Bursts of light around the ship draw after it, see-through or not.
    this.#bursts.points.renderOrder = LIGHT_ORDER
    scene.add(this.#bursts.points)

    scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x40205f, 0.8))
    const key = new THREE.DirectionalLight(0xfff0f5, 1.35)
    key.position.set(3, 6, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x6fe8ff, 2.2)
    rim.position.set(-5, 2, -6)
    scene.add(rim)
    const under = new THREE.DirectionalLight(0xff70d0, 1.2)
    under.position.set(2, -4, -3)
    scene.add(under)
    this.#flashLight = new THREE.PointLight(0xffb060, 0, 14, 2)
    scene.add(this.#flashLight)

    this.#ship = buildShip()
    this.#girl = buildGirl()
    this.#girl.group.rotation.y = Math.PI
    this.#girl.group.scale.setScalar(0.62)
    this.#girl.group.position.y = -0.2
    this.#ship.seat.add(this.#girl.group)
    scene.add(this.#ship.group)
    this.#ghost = new Ghost(this.#ship.group)
    this.#samples.add(this.#kit.makeOrb(), this.#kit.makeSpark().group)
    this.#samples.add(new HoleView('white', 4, 3).group)
    this.#samples.position.set(0, 0, 60)
    scene.add(this.#samples)
    scene.add(this.#hitboxes.group)
    this.#trails = [
      new Trail(22, 0.035, new THREE.Color(0.45, 0.9, 1.0)),
      new Trail(22, 0.035, new THREE.Color(1.0, 0.55, 0.9)),
    ]
    // The wing tips' light trails stream toward the camera, over the ship: they draw after it.
    for (const trail of this.#trails) {
      trail.mesh.renderOrder = LIGHT_ORDER
      scene.add(trail.mesh)
    }

    this.camera.position.set(0, 2, 7)
    this.camera.userData.baseFov = 58
    this.look.bloom = 0.8
    this.look.bloomThreshold = 1.0
    this.look.bloomRadius = 0.35
    this.look.vignette = 0.45
    // The title screen's logo and menu read better over a darker top and bottom.
    this.look.shade = options.demo ? 1 : 0
  }

  update(dt: number, controls: ControlFrame): void {
    const ride = this.ride
    const options = this.#options
    this.#samples.visible = false
    this.#time += dt
    if (!options.demo) {
      if (controls.pause) options.onPause?.()
      if (controls.recenter) options.onRecenter?.()
    }
    const steer = options.demo ? autopilot(ride) : controls.move
    const events = ride.advance(dt, ride.phase === 'riding' ? steer : { x: 0, y: 0 })
    const forward = ride.phase === 'warping' ? ride.forward * 0.25 : ride.forward
    this.#travel += forward * dt
    // The simulation steps 120 times a second, the screen draws as often as it does: the part of
    // a step not taken yet is drawn ahead, with the speeds the ship and the things have.
    const lag = ride.lag
    this.#shipX = ride.ship.x + ride.ship.vx * lag
    this.#shipY = ride.ship.y + ride.ship.vy * lag
    this.#ahead = ride.forward * lag
    for (const event of events) this.#handle(event)

    const uniforms = this.#uniforms
    uniforms.uTime.value = this.#time
    uniforms.uTravel.value = this.#travel
    uniforms.uSpeed.value = approach(uniforms.uSpeed.value, ride.speed, 3, dt)
    bendFor(this.#travel, this.#bend)
    // While warping, the tunnel straightens toward the hole.
    if (ride.phase !== 'riding') this.#bend.multiplyScalar(Math.max(0, 1 - ride.warp * 2))
    uniforms.uBend.value.copy(this.#bend)
    const warp = ride.phase === 'riding' ? 0 : Math.min(1, ride.warp / RIDE.warpTime)
    uniforms.uWarp.value = warp * warp
    uniforms.uHue.value = Math.sin(this.#travel * 0.00021) * 0.06

    this.#updateShip(dt)
    this.#updateThings(dt)
    this.#updateHitboxes()
    this.#shards.update(dt, this.#travel, this.#bend)
    this.#bursts.update(dt, forward)
    uniform(this.#kit.orbMaterial.uniforms, 'uTime').value = this.#time
    this.#updateCamera(dt, warp)
    this.#updateLook(dt, warp)
    if (!options.demo) this.#publishHud()
    if (ride.phase === 'done' && !this.#arrived) {
      this.#arrived = true
      const outcome = ride.outcome
      if (outcome) options.onArrive?.(outcome)
    }
  }

  #handle(event: RideEvent): void {
    const demo = this.#options.demo
    switch (event.type) {
      case 'orb': {
        const view = this.#orbs.get(event.orb.id)
        if (view) {
          this.#bursts.emit(view.position, 26, ORB_COLOR, { speed: 7, size: 0.22, life: 0.7 })
          this.#flashLight.position.copy(view.position)
        }
        this.#flashLight.intensity = 9
        this.#kick = Math.min(1, this.#kick + 0.35)
        if (!demo) emit({ type: 'orb', combo: event.combo })
        break
      }
      case 'spark': {
        const view = this.#sparks.get(event.spark.id)
        if (view)
          this.#bursts.emit(view.group.position, 40, SPARK_COLOR, {
            speed: 10,
            size: 0.18,
            life: 0.6,
          })
        this.#hurt = 1
        this.#shake = this.#options.reducedMotion?.() ? 0.15 : 1
        this.#flash = 0.35
        this.look.flashColor.setRGB(0.5, 0.7, 1.0)
        if (!demo) emit({ type: 'spark' })
        break
      }
      case 'hole':
        if (!demo) emit({ type: 'holeAppears', tier: event.hole.tier })
        break
      case 'captured':
        if (!demo) emit({ type: 'captured' })
        break
      case 'enter': {
        const outcome = this.ride.outcome
        if (outcome && !this.#options.demo) this.#options.onEnter?.(outcome)
        const view = this.#holes.get(event.hole.id)
        if (view)
          this.#bursts.emit(view.group.position, 80, HOLE_LIGHT[event.hole.color], {
            speed: 14,
            size: 0.3,
            life: 1.2,
          })
        this.look.flashColor.copy(HOLE_LIGHT[event.hole.color]).lerp(new THREE.Color(1, 1, 1), 0.6)
        if (!demo) emit({ type: 'enter', tier: event.hole.tier })
        break
      }
      case 'arrive':
        if (!demo) emit({ type: 'arrive' })
        break
    }
  }

  #updateShip(dt: number): void {
    const ride = this.ride
    const ship = ride.ship
    const group = this.#ship.group
    group.position.set(this.#shipX, this.#shipY, 0)
    if (ride.phase === 'warping' && ride.entered) {
      // Into the hole: the ship dives forward and shrinks away.
      const t = Math.min(1, ride.warp / RIDE.warpTime)
      group.position.z = -t * t * 30
      group.rotation.z += dt * t * 6
    } else {
      group.rotation.z = 0
    }
    const bankTarget = clamp(-ship.vx * 0.05, -0.75, 0.75)
    const pitchTarget = clamp(ship.vy * 0.025, -0.35, 0.35)
    this.#bank = approach(this.#bank, bankTarget, 6, dt)
    this.#pitch = approach(this.#pitch, pitchTarget, 6, dt)
    group.rotation.y = -ship.vx * 0.012
    // In a ride the ship sits where the player looks ahead: it lets the way show through. The
    // title screen's camera circles it, and shows it whole.
    const choice = settings.value.seeThrough
    const seeThrough =
      !this.#options.demo &&
      (choice === 'on' || (choice === 'auto' && SEE_THROUGH_LEVELS.has(this.#options.level.name)))
    this.#see = approach(this.#see, seeThrough ? SHIP_OPACITY : 1, 3, dt)
    // Whole again: drawn as an opaque model, without the depth pass, as cheap as on the title.
    if (!seeThrough && this.#see > 0.99) this.#see = 1
    this.#ghost.opacity = this.#see
    this.#hurt = Math.max(0, this.#hurt - dt * 1.6)
    const flicker = this.#hurt > 0 ? (Math.sin(this.#time * 60) > 0 ? this.#hurt : 0) : 0
    this.#ship.update(dt, this.#time, {
      thrust: ride.speed,
      bank: this.#bank,
      pitch: this.#pitch,
      hurt: flicker,
    })
    this.#girl.update(dt, this.#time, {
      mode: 'sit',
      wind: 0.6 + ride.speed * 0.5,
      lean: this.#bank,
      look: clamp(ship.vx * 0.03, -0.5, 0.5),
    })
    for (const [index, trail] of this.#trails.entries()) {
      const tip = this.#ship.wingTips[index] as THREE.Object3D
      const head = tip.getWorldPosition(new THREE.Vector3())
      trail.update(head, 0.12 + ride.speed * 0.08, 0.35 + Math.min(1, ride.speed - 0.5) * 0.4)
    }
  }

  /** Draws the rules' circles over the ride, where they are asked for. */
  #updateHitboxes(): void {
    const boxes = this.#hitboxes
    boxes.group.visible = settings.value.showHitboxes
    if (!boxes.group.visible) return
    const ride = this.ride
    boxes.begin()
    const circle = (
      kind: Parameters<Hitboxes['circle']>[0],
      x: number,
      y: number,
      z: number,
      radius: number,
    ) => {
      bendAt(z, this.#bend, this.#offset)
      boxes.circle(kind, x + this.#offset.x, y + this.#offset.y, -z, radius)
    }
    circle('field', 0, 0, 0, RIDE.fieldRadius)
    circle('ship', this.#shipX, this.#shipY, 0, RIDE.shipRadius)
    const ahead = this.#ahead
    for (const orb of ride.orbs)
      if (!orb.taken) circle('orb', orb.x, orb.y, orb.z - ahead, RIDE.orbRadius)
    for (const spark of ride.sparks)
      circle('spark', spark.x, spark.y, spark.z - ahead, RIDE.sparkRadius)
    for (const hole of ride.holes)
      circle('hole', hole.x, hole.y, hole.z - ahead, hole.radius * RIDE.holeInside)
    boxes.end()
  }

  /** How many hitbox circles show, for tests and the debug hook. */
  get hitboxesShown(): number {
    return this.#hitboxes.shown
  }

  /** Puts every orb, spark and hole where the simulation has it, bent like the tunnel. */
  #updateThings(dt: number): void {
    const ride = this.ride
    const camera = this.camera
    const place = (object: THREE.Object3D, x: number, y: number, simulated: number) => {
      const z = simulated - this.#ahead
      bendAt(z, this.#bend, this.#offset)
      object.position.set(x + this.#offset.x, y + this.#offset.y, -z)
    }
    const fadeIn = (z: number, far: number) => clamp((far - z) / 60, 0, 1)

    const seenOrbs = new Set<number>()
    for (const orb of ride.orbs) {
      if (orb.taken) continue
      seenOrbs.add(orb.id)
      let view = this.#orbs.get(orb.id)
      if (!view) {
        view = this.#orbPool.pop() ?? this.#kit.makeOrb()
        this.scene.add(view)
        this.#orbs.set(orb.id, view)
      }
      place(view, orb.x, orb.y, orb.z)
      const scale =
        fadeIn(orb.z, RIDE.spawnDistance) * (1 + Math.sin(this.#time * 5 + orb.id) * 0.06)
      view.scale.setScalar(Math.max(0.001, scale))
    }
    for (const [id, view] of this.#orbs) {
      if (seenOrbs.has(id)) continue
      this.scene.remove(view)
      this.#orbs.delete(id)
      this.#orbPool.push(view)
    }

    const seenSparks = new Set<number>()
    for (const spark of ride.sparks) {
      seenSparks.add(spark.id)
      let view = this.#sparks.get(spark.id)
      if (!view) {
        view = this.#sparkPool.pop() ?? this.#kit.makeSpark()
        this.scene.add(view.group)
        this.#sparks.set(spark.id, view)
      }
      place(view.group, spark.x, spark.y, spark.z)
      const fade = fadeIn(spark.z, RIDE.spawnDistance) * (spark.hit ? 0.3 : 1)
      view.group.scale.setScalar(Math.max(0.001, fade))
      view.arcs.quaternion.copy(camera.quaternion)
      const material = view.arcs.material as THREE.ShaderMaterial
      uniform(material.uniforms, 'uTime').value = this.#time
      view.core.rotation.x += dt * 2.1
      view.core.rotation.y += dt * 1.3
    }
    for (const [id, view] of this.#sparks) {
      if (seenSparks.has(id)) continue
      this.scene.remove(view.group)
      this.#sparks.delete(id)
      this.#sparkPool.push(view)
    }

    const seenHoles = new Set<number>()
    const pull = ride.pull
    for (const hole of ride.holes) {
      seenHoles.add(hole.id)
      let view = this.#holes.get(hole.id)
      if (!view) {
        view = new HoleView(hole.color, hole.tier, hole.radius)
        this.scene.add(view.group)
        this.#holes.set(hole.id, view)
      }
      place(view.group, hole.x, hole.y, hole.z)
      const entered = ride.entered === hole
      if (entered) {
        const t = Math.min(1, ride.warp / RIDE.warpTime)
        view.group.scale.setScalar(1 + t * t * 7)
      }
      const fade = entered
        ? 1
        : fadeIn(hole.z, RIDE.holeSpawnDistance) * clamp((hole.z + 8) / 10, 0, 1)
      view.update(this.#time, camera, fade, hole === ride.captured ? 1 : pull * 0.6)
    }
    for (const [id, view] of this.#holes) {
      if (seenHoles.has(id)) continue
      this.scene.remove(view.group)
      view.dispose()
      this.#holes.delete(id)
    }
  }

  #updateCamera(dt: number, warp: number): void {
    const ride = this.ride
    // Where the ship is drawn, so the camera follows it as smoothly as the screen draws.
    const ship = { x: this.#shipX, y: this.#shipY }
    const camera = this.camera
    if (this.#options.demo) {
      const t = this.#time * 0.16
      this.#cameraTarget.set(
        ship.x + Math.sin(t) * 4.6,
        ship.y + 1.1 + Math.sin(t * 0.7) * 0.7,
        Math.cos(t) * 4.6 - 0.6,
      )
      camera.position.lerp(this.#cameraTarget, damp(2, dt))
      this.#lookTarget.set(ship.x, ship.y + 0.35, 0)
    } else {
      const speedBack = clamp(ride.speed - 1, -0.5, 1.5)
      this.#cameraTarget.set(ship.x * 0.62, ship.y * 0.62 + 1.45, 5.1 + speedBack * 0.55)
      if (ride.phase === 'warping') this.#cameraTarget.z -= warp * warp * 18
      camera.position.lerp(this.#cameraTarget, damp(ride.phase === 'warping' ? 2.5 : 5, dt))
      bendAt(70, this.#bend, this.#offset)
      this.#lookTarget.set(
        ship.x * 0.8 + this.#offset.x * 0.12,
        ship.y * 0.8 + 0.55 + this.#offset.y * 0.12,
        -16,
      )
      if (ride.phase === 'warping' && ride.entered) {
        const hole = ride.entered
        this.#lookTarget.set(hole.x, hole.y, -10)
      }
    }
    this.#lookNow.lerp(this.#lookTarget, damp(6, dt))
    // A hit shakes the camera for a moment.
    this.#shake = Math.max(0, this.#shake - dt * 2.5)
    const shake = this.#shake * this.#shake * 0.35
    camera.position.x += (Math.random() - 0.5) * shake
    camera.position.y += (Math.random() - 0.5) * shake
    camera.up.set(Math.sin(this.#bank * 0.25), 1, 0).normalize()
    camera.lookAt(this.#lookNow)
    const reduced = this.#options.reducedMotion?.() ?? false
    this.#kick = Math.max(0, this.#kick - dt * 1.8)
    const fov =
      58 +
      clamp(ride.speed - 1, -0.4, 1.6) * (reduced ? 4 : 9) +
      this.#kick * (reduced ? 1 : 4) +
      warp * warp * 45
    applyFov(camera, approach(camera.userData.baseFov as number, fov, 4, dt))
  }

  #updateLook(dt: number, warp: number): void {
    const look = this.look
    const ride = this.ride
    const reduced = this.#options.reducedMotion?.() ?? false
    const fast = clamp(ride.speed - 1, 0, 1.6)
    look.aberration = (reduced ? 0 : fast * 0.012) + this.#shake * 0.02 + warp * 0.05
    look.radialBlur = reduced ? 0 : fast * 0.05 + warp * 0.25
    this.#flash = Math.max(0, this.#flash - dt * 1.8)
    look.flash =
      Math.max(this.#flash, ride.phase === 'riding' ? 0 : smooth(warp, 0.55, 1) * 0.95) *
      (reduced ? 0.5 : 1)
    if (ride.phase === 'riding') look.flashColor.lerp(new THREE.Color(0.5, 0.7, 1.0), damp(1, dt))
    this.#flashLight.intensity = Math.max(0, this.#flashLight.intensity - dt * 30)
    look.bloom = 0.8 + warp * 0.9
    look.exposure = 1 + warp * 0.6
  }

  #publishHud(): void {
    const ride = this.ride
    rideFeel.speed = ride.speed
    rideFeel.pull = ride.pull
    const now = performance.now()
    const next = nextRideHud(
      rideHud.value,
      {
        distance: Math.floor(ride.distance),
        speed: ride.speed,
        pull: ride.pull,
        combo: ride.combo,
        stunned: ride.stun > 0,
        captured: ride.captured !== undefined,
        warping: ride.phase !== 'riding',
        orbs: ride.orbsTaken,
        sparks: ride.sparksHit,
        time: ride.time,
      },
      now - this.#hudShownAt,
    )
    if (next !== rideHud.value) {
      rideHud.value = next
      this.#hudShownAt = now
    }
  }

  /** The hole the ship is headed into, for tests and the debug hook. */
  get holes(): readonly Hole[] {
    return this.ride.holes
  }

  dispose(): void {
    this.scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.LineSegments
      ) {
        // An outline draws its mesh's own geometry, with a material all stages share; so does
        // the ghost's depth pass.
        if (object.name === 'outline' || object.name === 'ghost-depth') return
        object.geometry.dispose()
        disposeMaterials(object.material)
      } else if (object instanceof THREE.Sprite) object.material.dispose()
    })
    for (const view of this.#holes.values()) view.dispose()
    this.#ship.dispose()
    this.#girl.dispose()
    this.#ghost.dispose()
    this.#hitboxes.dispose()
    this.#kit.dispose()
  }
}

function smooth(value: number, from: number, to: number): number {
  const x = clamp((value - from) / (to - from), 0, 1)
  return x * x * (3 - 2 * x)
}
