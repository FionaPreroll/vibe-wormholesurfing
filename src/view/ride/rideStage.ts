import * as THREE from 'three'
import { approach, clamp, damp } from '../../core/math'
import { autopilot, type Hole, RIDE, Ride, type RideEvent, type RideOutcome } from '../../core/ride'
import { emit } from '../../game/events'
import { rideHud } from '../../game/hud'
import type { ControlFrame } from '../../input/input'
import { applyFov, type Stage } from '../engine'
import { buildGirl, type GirlRig } from '../models/girl'
import { buildShip, type ShipRig } from '../models/ship'
import { defaultLook, type Look } from '../post'
import type { QualityLevel } from '../quality'
import { uniform } from '../uniforms'
import { bendAt, bendFor } from './bend'
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
  /** Called once the ship has gone through a hole. */
  readonly onArrive?: (outcome: RideOutcome) => void
  /** The player asked to pause. */
  readonly onPause?: () => void
  /** The player asked to set the tilt's straight ahead. */
  readonly onRecenter?: () => void
}

const ORB_COLOR = new THREE.Color(1.0, 0.7, 0.3)
const SPARK_COLOR = new THREE.Color(0.55, 0.75, 1.0)

/** Space as seen from a ship, for the environment map's reflections. */
function spaceEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene()
  const geometry = new THREE.SphereGeometry(10, 32, 16)
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec3 top = vec3(0.55, 0.5, 1.2);
        vec3 bottom = vec3(0.12, 0.05, 0.3);
        vec3 color = mix(bottom, top, vDir.y * 0.5 + 0.5);
        color += vec3(1.2, 0.5, 1.0) * pow(max(0.0, dot(vDir, normalize(vec3(-0.6, 0.3, -0.7)))), 6.0);
        color += vec3(0.4, 1.0, 1.4) * pow(max(0.0, dot(vDir, normalize(vec3(0.7, 0.2, 0.6)))), 8.0);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
  scene.add(new THREE.Mesh(geometry, material))
  const pmrem = new THREE.PMREMGenerator(renderer)
  const texture = pmrem.fromScene(scene, 0.02).texture
  pmrem.dispose()
  geometry.dispose()
  material.dispose()
  return texture
}

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
  readonly #kit = new ThingKit()
  readonly #orbs = new Map<number, THREE.Group>()
  readonly #orbPool: THREE.Group[] = []
  readonly #sparks = new Map<number, ReturnType<ThingKit['makeSpark']>>()
  readonly #sparkPool: ReturnType<ThingKit['makeSpark']>[] = []
  readonly #holes = new Map<number, HoleView>()
  readonly #bursts: Bursts
  readonly #shards: Shards
  readonly #trails: Trail[]
  readonly #environment: THREE.Texture
  readonly #flashLight: THREE.PointLight
  readonly #bend = new THREE.Vector2()
  readonly #offset = new THREE.Vector2()
  readonly #cameraTarget = new THREE.Vector3()
  readonly #lookTarget = new THREE.Vector3(0, 0, -20)
  readonly #lookNow = new THREE.Vector3(0, 0, -20)
  #time = 0
  #travel = 0
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
    this.#environment = spaceEnvironment(renderer)
    scene.environment = this.#environment
    scene.environmentIntensity = 0.55
    scene.add(buildTunnel(this.#uniforms))
    scene.add(buildDust(this.#uniforms, Math.round(2600 * level.detail)))
    scene.add(buildStreaks(this.#uniforms, Math.round(260 * level.detail)))
    this.#shards = new Shards(Math.round(70 * level.detail))
    scene.add(this.#shards.mesh)
    this.#bursts = new Bursts(900)
    this.#bursts.setPixelRatio(renderer.getPixelRatio())
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
    this.#trails = [
      new Trail(28, 0.07, new THREE.Color(0.45, 0.9, 1.0)),
      new Trail(28, 0.07, new THREE.Color(1.0, 0.55, 0.9)),
    ]
    for (const trail of this.#trails) scene.add(trail.mesh)

    this.camera.position.set(0, 2, 7)
    this.camera.userData.baseFov = 58
    this.look.bloom = 0.8
    this.look.bloomThreshold = 1.0
    this.look.bloomRadius = 0.35
    this.look.vignette = 0.45
  }

  update(dt: number, controls: ControlFrame): void {
    const ride = this.ride
    const options = this.#options
    this.#time += dt
    if (!options.demo) {
      if (controls.pause) options.onPause?.()
      if (controls.recenter) options.onRecenter?.()
    }
    const steer = options.demo ? autopilot(ride) : controls.move
    const events = ride.advance(dt, ride.phase === 'riding' ? steer : { x: 0, y: 0 })
    const forward = ride.phase === 'warping' ? ride.forward * 0.25 : ride.forward
    this.#travel += forward * dt
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
    group.position.set(ship.x, ship.y, 0)
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

  /** Puts every orb, spark and hole where the simulation has it, bent like the tunnel. */
  #updateThings(dt: number): void {
    const ride = this.ride
    const camera = this.camera
    const place = (object: THREE.Object3D, x: number, y: number, z: number) => {
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
        view.group.scale.setScalar(1 + t * t * 14)
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
    const ship = ride.ship
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
    rideHud.value = {
      distance: Math.floor(ride.distance),
      speed: ride.speed,
      pull: ride.pull,
      combo: ride.combo,
      stunned: ride.stun > 0,
      captured: ride.captured !== undefined,
      warping: ride.phase !== 'riding',
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
        object.geometry.dispose()
        const material = object.material
        if (Array.isArray(material)) for (const entry of material) entry.dispose()
        else material.dispose()
      } else if (object instanceof THREE.Sprite) object.material.dispose()
    })
    for (const view of this.#holes.values()) view.dispose()
    this.#ship.dispose()
    this.#girl.dispose()
    this.#kit.dispose()
    this.#environment.dispose()
  }
}

function smooth(value: number, from: number, to: number): number {
  const x = clamp((value - from) / (to - from), 0, 1)
  return x * x * (3 - 2 * x)
}
