import * as THREE from 'three'
import type { Expedition, ExpeditionEvent } from '../../core/expedition'
import type { HoleColor, HoleTier } from '../../core/holes'
import { angleDelta, approach, clamp, damp, length2 } from '../../core/math'
import { RARITIES, type Reward } from '../../core/rewards'
import { emit } from '../../game/events'
import { worldHud } from '../../game/hud'
import type { ControlFrame } from '../../input/input'
import { applyFov, type Stage } from '../engine'
import { buildGirl, type GirlMode, type GirlRig } from '../models/girl'
import { RARITY_COLORS } from '../models/items'
import { buildShip, type ShipRig } from '../models/ship'
import { defaultLook, type Look } from '../post'
import type { QualityLevel } from '../quality'
import { Bursts } from '../ride/particles'
import { HoleView } from '../ride/things'
import { buildCeiling, buildIslands, buildMotes, buildProps } from './scenery'
import { buildSky, updateSky } from './sky'
import { buildTerrain } from './terrain'
import { THEMES } from './themes'
import { TreasureView } from './treasure'
import { buildWater, updateWater } from './water'

export interface WorldStageOptions {
  readonly expedition: Expedition
  readonly level: QualityLevel
  /** The hole the ship came through, which hangs in the sky for a moment after arrival. */
  readonly arrival: { readonly color: HoleColor; readonly tier: HoleTier }
  readonly reducedMotion?: () => boolean
  readonly onReveal?: (reward: Reward) => void
  readonly onPause?: () => void
}

const INTRO = 2.6

/**
 * A world behind a warp hole, explored on foot: the girl walks where the stick or keys send her,
 * relative to the camera, which follows her and can be turned. Somewhere a pillar of light marks
 * the treasure.
 */
export class WorldStage implements Stage {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2000)
  readonly look: Look = defaultLook()
  readonly expedition: Expedition

  readonly #options: WorldStageOptions
  readonly #time = { value: 0 }
  readonly #sky: THREE.Mesh
  readonly #water: THREE.Mesh | undefined
  readonly #sun: THREE.DirectionalLight
  readonly #sunOffset: THREE.Vector3
  readonly #girl: GirlRig
  readonly #ship: ShipRig
  readonly #portal: HoleView
  readonly #treasure: TreasureView
  readonly #bursts = new Bursts(500)
  readonly #islands: THREE.Group | undefined
  readonly #environment: THREE.Texture
  readonly #target = new THREE.Vector3()
  readonly #focus = new THREE.Vector3()
  readonly #desired = new THREE.Vector3()
  #yaw = 0
  #pitch = 0.24
  #distance = 6.5
  #idleLook = 10
  #stepDistance = 0
  #lastX = 0
  #lastZ = 0
  #revealed = false

  constructor(renderer: THREE.WebGLRenderer, options: WorldStageOptions) {
    this.#options = options
    const expedition = options.expedition
    this.expedition = expedition
    const theme = THEMES[expedition.world]
    const level = options.level
    const scene = this.scene

    scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far)
    scene.background = new THREE.Color(theme.fog.color)
    this.#sky = buildSky(theme)
    scene.add(this.#sky)
    // Reflections come from the sky itself.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const skyScene = new THREE.Scene()
    skyScene.add(buildSky(theme))
    this.#environment = pmrem.fromScene(skyScene, 0.04).texture
    pmrem.dispose()
    scene.environment = this.#environment
    scene.environmentIntensity = 0.5

    const light = theme.light
    scene.add(
      new THREE.HemisphereLight(light.skyAmbient, light.groundAmbient, light.ambientIntensity),
    )
    this.#sun = new THREE.DirectionalLight(light.sun, light.sunIntensity)
    this.#sunOffset = new THREE.Vector3(...theme.sky.sunDir).normalize().multiplyScalar(70)
    if (this.#sunOffset.y < 25) this.#sunOffset.y = 25
    if (level.shadows > 0) {
      this.#sun.castShadow = true
      this.#sun.shadow.mapSize.set(level.shadows, level.shadows)
      const camera = this.#sun.shadow.camera
      camera.left = -32
      camera.right = 32
      camera.top = 32
      camera.bottom = -32
      camera.near = 1
      camera.far = 180
      this.#sun.shadow.bias = -0.0004
      this.#sun.shadow.normalBias = 0.04
    }
    scene.add(this.#sun)
    scene.add(this.#sun.target)

    const seed = expedition.seed
    const terrain = buildTerrain(expedition.land, theme, level.detail, seed)
    scene.add(terrain.mesh)
    const water = expedition.land.shape.water
    if (water !== undefined) {
      this.#water = buildWater(water, theme, terrain.heights)
      scene.add(this.#water)
    }
    scene.add(
      buildProps(expedition.props, theme, this.#time, level.detail, level.shadows > 0, seed),
    )
    scene.add(buildMotes(theme, expedition.land, this.#time, level.detail, seed))
    if (expedition.layout.ceiling !== undefined)
      scene.add(buildCeiling(expedition.layout.ceiling, theme, seed))
    if (theme.islands) {
      this.#islands = buildIslands(theme, seed)
      scene.add(this.#islands)
    }

    this.#treasure = new TreasureView(expedition.reward, level.name !== 'low')
    const spot = expedition.treasure
    this.#treasure.group.position.set(spot.x, spot.y, spot.z)
    this.#treasure.group.rotation.y = Math.atan2(-spot.x, -spot.z)
    scene.add(this.#treasure.group)

    this.#ship = buildShip()
    this.#ship.group.scale.setScalar(1.7)
    const walker = expedition.walker
    // The ship waits beside the landing site, off to her left and out of the camera's way.
    const shipX = walker.x + Math.cos(walker.yaw) * 5.5 + Math.sin(walker.yaw) * 1.5
    const shipZ = walker.z - Math.sin(walker.yaw) * 5.5 + Math.cos(walker.yaw) * 1.5
    this.#ship.group.position.set(shipX, expedition.land.heightAt(shipX, shipZ) + 1.3, shipZ)
    this.#ship.group.rotation.y = walker.yaw + Math.PI * 0.85
    scene.add(this.#ship.group)

    this.#girl = buildGirl()
    scene.add(this.#girl.group)

    this.#portal = new HoleView(options.arrival.color, options.arrival.tier, 4)
    this.#portal.group.position.set(
      shipX * 0.5,
      expedition.land.heightAt(0, 0) + 14,
      shipZ * 0.5 - 4,
    )
    scene.add(this.#portal.group)

    this.#bursts.setPixelRatio(renderer.getPixelRatio())
    scene.add(this.#bursts.points)

    this.#yaw = walker.yaw + Math.PI
    this.#lastX = walker.x
    this.#lastZ = walker.z
    this.#focus.set(walker.x, walker.y + 1.1, walker.z)
    this.camera.userData.baseFov = 55
    this.camera.position.set(
      walker.x + Math.sin(this.#yaw) * 14,
      walker.y + 16,
      walker.z + Math.cos(this.#yaw) * 14,
    )
    this.camera.lookAt(this.#focus)

    this.look.exposure = theme.exposure
    this.look.bloom = theme.bloom
    this.look.bloomThreshold = 0.95
    this.look.bloomRadius = 0.45
    this.look.vignette = 0.3
    this.look.grain = 0.025
    // Tone mapping pales bright daylight; a little more color brings it back.
    this.look.saturation = 1.18
    this.look.flash = 1
    this.look.flashColor.setRGB(1, 1, 1)
  }

  update(dt: number, controls: ControlFrame): void {
    const expedition = this.expedition
    const time = expedition.time + dt
    this.#time.value = time
    const intro = clamp(time / INTRO, 0, 1)
    const exploring = expedition.phase === 'exploring'
    if (controls.pause && expedition.phase !== 'opening') this.#options.onPause?.()

    // Camera-relative walking: up on the stick walks away from the camera.
    const forwardX = -Math.sin(this.#yaw)
    const forwardZ = -Math.cos(this.#yaw)
    const rightX = Math.cos(this.#yaw)
    const rightZ = -Math.sin(this.#yaw)
    const move = intro < 0.5 ? { x: 0, y: 0 } : controls.move
    const walk = {
      x: rightX * move.x + forwardX * move.y,
      z: rightZ * move.x + forwardZ * move.y,
      jump: controls.confirm && !expedition.canOpen && intro >= 0.5,
    }
    const interact = (controls.interact || controls.confirm) && expedition.canOpen
    for (const event of expedition.step(dt, walk, interact)) this.#handle(event)

    const walker = expedition.walker
    if (walker.grounded && exploring) {
      this.#stepDistance += length2(walker.x - this.#lastX, walker.z - this.#lastZ)
      if (this.#stepDistance > 1.15) {
        this.#stepDistance = 0
        emit({ type: 'step', wet: walker.wading })
      }
    }
    this.#lastX = walker.x
    this.#lastZ = walker.z

    this.#updateGirl(dt, time)
    this.#updateCamera(dt, controls, intro)
    this.#updateWorld(dt, time, intro)
    this.#publishHud()
  }

  #handle(event: ExpeditionEvent): void {
    switch (event.type) {
      case 'jump':
        emit({ type: 'jump' })
        break
      case 'land':
        emit({ type: 'land' })
        break
      case 'open':
        emit({ type: 'open' })
        break
      case 'reveal': {
        const reward = event.reward
        const at = this.#treasure.itemPosition()
        const color = new THREE.Color(RARITY_COLORS[reward.item.rarity])
        this.#bursts.emit(at, 120, color, { speed: 9, size: 0.18, life: 1.6 })
        if (reward.shiny)
          this.#bursts.emit(at, 80, new THREE.Color(1, 0.8, 1), { speed: 6, size: 0.14, life: 2 })
        this.look.flash = this.#options.reducedMotion?.() ? 0.2 : 0.55
        this.look.flashColor.copy(color)
        this.#revealed = true
        emit({ type: 'reveal', rarity: RARITIES.indexOf(reward.item.rarity), shiny: reward.shiny })
        this.#options.onReveal?.(reward)
        break
      }
    }
  }

  #updateGirl(dt: number, time: number): void {
    const expedition = this.expedition
    const walker = expedition.walker
    const girl = this.#girl.group
    girl.position.set(walker.x, walker.y, walker.z)
    girl.rotation.y = walker.yaw
    let mode: GirlMode = walker.grounded ? (walker.pace > 0.08 ? 'walk' : 'stand') : 'air'
    if (expedition.phase === 'opening') mode = 'stand'
    if (expedition.phase === 'revealed') mode = 'cheer'
    if (expedition.time < INTRO + 0.6 && walker.pace < 0.05) mode = 'wave'
    this.#girl.update(dt, time, {
      mode,
      pace: walker.pace,
      wind: 0.15 + walker.pace * 0.4,
      rise: walker.vy,
    })
  }

  #updateCamera(dt: number, controls: ControlFrame, intro: number): void {
    const expedition = this.expedition
    const walker = expedition.walker
    const camera = this.camera
    const looking = Math.abs(controls.look.x) + Math.abs(controls.look.y) > 1e-4
    this.#idleLook = looking ? 0 : this.#idleLook + dt
    this.#yaw -= controls.look.x
    this.#pitch = clamp(this.#pitch + controls.look.y, -0.15, 1.2)
    this.#distance = clamp(this.#distance + controls.zoom, 3.2, 13)
    // Walking with the camera left alone, it swings round behind her.
    if (this.#idleLook > 1.2 && walker.pace > 0.3 && expedition.phase === 'exploring') {
      const behind = walker.yaw + Math.PI
      this.#yaw += angleDelta(this.#yaw, behind) * damp(0.9 * walker.pace, dt)
    }

    let yaw = this.#yaw
    let pitch = this.#pitch
    let distance = this.#distance
    this.#target.set(walker.x, walker.y + 1.35, walker.z)
    if (expedition.phase !== 'exploring') {
      // Frame the girl and the treasure from the side while it opens.
      const treasure = expedition.treasure
      const dx = treasure.x - walker.x
      const dz = treasure.z - walker.z
      // Of the two sides, the one nearer to where the camera already is.
      const along = Math.atan2(dx, dz)
      const left = along + Math.PI / 2
      const right = along - Math.PI / 2
      const side =
        Math.abs(angleDelta(this.#yaw, left)) < Math.abs(angleDelta(this.#yaw, right))
          ? left
          : right
      yaw = this.#yaw + angleDelta(this.#yaw, side)
      this.#yaw = approach(this.#yaw, yaw, 2.2, dt)
      yaw = this.#yaw
      pitch = 0.26
      distance = 6.4
      this.#target.set(
        walker.x * 0.4 + treasure.x * 0.6,
        walker.y + 1.5,
        walker.z * 0.4 + treasure.z * 0.6,
      )
    }
    // The arrival swoops down from high above.
    const swoop = 1 - (1 - intro) ** 3
    pitch = pitch + (1.15 - pitch) * (1 - swoop)
    distance = distance + (18 - distance) * (1 - swoop)

    this.#focus.lerp(this.#target, damp(9, dt))
    this.#desired.set(
      this.#focus.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      this.#focus.y + Math.sin(pitch) * distance,
      this.#focus.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    )
    // Keep the camera above the ground and under a cave's ceiling.
    const ground = expedition.land.heightAt(this.#desired.x, this.#desired.z) + 0.7
    if (this.#desired.y < ground) this.#desired.y = ground
    const ceiling = expedition.layout.ceiling
    if (ceiling !== undefined) this.#desired.y = Math.min(this.#desired.y, ceiling - 2)
    camera.position.lerp(this.#desired, damp(intro < 1 ? 6 : 10, dt))
    camera.lookAt(this.#focus)
    applyFov(camera, 55)
  }

  #updateWorld(dt: number, time: number, intro: number): void {
    const expedition = this.expedition
    const walker = expedition.walker
    updateSky(this.#sky, time)
    if (this.#water) updateWater(this.#water, time)
    this.#sun.position.set(walker.x, walker.y, walker.z).add(this.#sunOffset)
    this.#sun.target.position.set(walker.x, walker.y, walker.z)
    this.#ship.update(dt, time, { thrust: 0.15, bank: Math.sin(time * 0.7) * 0.04, pitch: 0 })
    this.#ship.group.position.y += Math.sin(time * 1.3) * 0.004
    const portalFade = clamp(1 - (time - 1.2) / 2.5, 0, 1)
    this.#portal.group.visible = portalFade > 0
    this.#portal.group.scale.setScalar(0.4 + portalFade * 0.8)
    this.#portal.update(time, this.camera, portalFade, 0)
    const opening = expedition.phase === 'exploring' ? -1 : expedition.opening
    this.#treasure.update(dt, time, opening, expedition.phase === 'revealed')
    this.#bursts.update(dt, 0)
    if (this.#islands)
      for (const island of this.#islands.children)
        island.position.y += Math.sin(time * 0.4 + (island.userData.bob as number)) * dt * 0.4
    const reduced = this.#options.reducedMotion?.() ?? false
    this.look.flash = Math.max(
      this.#revealed ? 0 : (1 - intro) ** 2,
      this.look.flash - dt * (reduced ? 3 : 1.4),
    )
  }

  #publishHud(): void {
    const expedition = this.expedition
    const walker = expedition.walker
    const treasure = expedition.treasure
    const toward = Math.atan2(treasure.x - walker.x, treasure.z - walker.z)
    // The camera looks along yaw + π; a bearing of 0 is straight ahead on screen.
    const facing = this.#yaw + Math.PI
    worldHud.value = {
      treasureBearing: -angleDelta(facing, toward),
      treasureDistance: Math.round(expedition.treasureDistance),
      canOpen: expedition.canOpen,
      phase: expedition.phase,
    }
  }

  dispose(): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        if (object.name === 'outline') return
        object.geometry.dispose()
        const material = object.material
        if (Array.isArray(material)) for (const entry of material) entry.dispose()
        else material.dispose()
      }
    })
    this.#girl.dispose()
    this.#ship.dispose()
    this.#portal.dispose()
    this.#treasure.dispose()
    this.#environment.dispose()
  }
}
