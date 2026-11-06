import * as THREE from 'three'
import { Expedition } from '../core/expedition'
import { itemById, type Reward } from '../core/rewards'
import type { RideOutcome } from '../core/ride'
import { debugLog } from '../game/debugLog'
import type { Arrival } from '../game/hud'
import type { Quality } from '../game/settings'
import type { ControlFrame, Input } from '../input/input'
import { Engine, type FrameStats } from './engine'
import { skyEnvironment } from './environments'
import { afterNextFrame } from './frames'
import { buildItem, disposeItem, RARITY_COLORS } from './models/items'
import { RideStage } from './ride/rideStage'
import { buildSky } from './world/sky'
import { buildTerrainInSteps } from './world/terrain'
import { THEMES } from './world/themes'
import { WorldStage } from './world/worldStage'

export interface DirectorHooks {
  /** The ship entered a hole: the outcome is settled, the warp has begun. */
  readonly onEnter: (outcome: RideOutcome) => void
  readonly onArrive: (outcome: RideOutcome) => void
  readonly onReveal: (reward: Reward) => void
  readonly onPause: () => void
  readonly onRecenter: () => void
  readonly reducedMotion: () => boolean
  /** Every frame, with the controls, for things outside the 3D view. */
  readonly onFrame?: (dt: number, controls: ControlFrame) => void
}

/** What the interface asks of the 3D view, which loads on demand. */
export interface Director {
  readonly stats: FrameStats
  showTitle(): void
  startRide(seed: number): void
  /**
   * Builds the world behind the hole and compiles its shaders in the background, while the warp
   * plays, so it can show without a stall.
   */
  prepareWorld(arrival: Arrival, found: ReadonlySet<string>): void
  /**
   * Shows the world, as soon as it is ready: the one prepared for this arrival, or one built now.
   * Resolves true once it shows, false if the ride was left meanwhile.
   */
  enterWorld(arrival: Arrival, found: ReadonlySet<string>): Promise<boolean>
  setPaused(paused: boolean): void
  setQuality(quality: Quality): void
  /** A picture of a treasure, as an image address, for the collection. */
  thumbnail(itemId: string, shiny: boolean, size?: number): string
  /** The graphics as they run now, for the debug log. */
  diagnostics(): Record<string, unknown>
  /** The current ride or world, for tests that drive the game. */
  readonly stage: RideStage | WorldStage | undefined
  dispose(): void
}

export function createDirector(
  canvas: HTMLCanvasElement,
  input: Input,
  quality: Quality,
  hooks: DirectorHooks,
): Director {
  const engine = new Engine(canvas, input, quality)
  engine.onFrame = hooks.onFrame
  engine.start()
  let current: RideStage | WorldStage | undefined
  const thumbnails = new Map<string, string>()
  /** The world being made ready for the ride under way, by the seed of its arrival. */
  let prepared: { seed: number; ready: Promise<WorldStage> } | undefined
  /** Counts new rides and title screens: a world made for an earlier one is not shown. */
  let generation = 0

  /** Counts stage switches: a stage still compiling when another comes is dropped. */
  let switching = 0

  const show = (stage: RideStage | WorldStage, label: string) => {
    switching++
    current = stage
    engine.setStage(stage, label)
  }

  /**
   * Shows a title screen's or a ride's stage once its shaders are ready, while the stage before
   * goes on. Compiling first also lets it take over the programs of the stage before: three.js
   * frees a program once no material uses it, so a stage shown at once would build again, in its
   * first frame, every program the stage it replaced had just let go (18 at every start of a
   * ride, a stall of a tenth of a second on Windows). The very first title screen compiles its
   * programs alongside the frames this way, instead of in one first frame of two seconds there.
   */
  const showWhenReady = (stage: RideStage, label: string) => {
    const mine = ++switching
    const ready = () => {
      if (mine === switching) show(stage, label)
      else stage.dispose()
    }
    engine.prepare(stage).then(ready, (error: unknown) => {
      debugLog.log('warn', `Could not compile ${label} ahead: ${String(error)}`)
      ready()
    })
  }

  /** Drops the world made ready for a ride that ended otherwise. */
  const forget = () => {
    generation++
    const dropped = prepared
    prepared = undefined
    void dropped?.ready.then((stage) => stage.dispose()).catch(() => {})
  }

  /**
   * Makes a world ready in steps a frame apart, so that no frame stalls long while the warp
   * plays: the world's rules, the ground in bands, the rest of the stage, then its shaders,
   * compiled alongside the frames.
   */
  const prepare = async (arrival: Arrival, found: ReadonlySet<string>): Promise<WorldStage> => {
    const started = performance.now()
    let stepStarted = started
    let longest = 0
    const pause = async () => {
      longest = Math.max(longest, performance.now() - stepStarted)
      await afterNextFrame()
      stepStarted = performance.now()
    }
    await pause()
    const expedition = new Expedition({
      world: arrival.world,
      seed: arrival.seed,
      tier: arrival.tier,
      distance: arrival.distance,
      found,
    })
    await pause()
    const terrain = await buildTerrainInSteps(
      expedition.land,
      THEMES[arrival.world],
      engine.level.detail,
      arrival.seed,
      pause,
    )
    await pause()
    const theme = THEMES[arrival.world]
    const envSky = buildSky(theme)
    const environment = await skyEnvironment(engine.renderer, envSky, async (scene, camera) => {
      // Frames go on while the sky's shader compiles: that wait is no step.
      longest = Math.max(longest, performance.now() - stepStarted)
      await engine.compile(scene, camera)
      stepStarted = performance.now()
    })
    await pause()
    const stage = new WorldStage(engine.renderer, {
      expedition,
      level: engine.level,
      arrival,
      terrain,
      environment,
      reducedMotion: hooks.reducedMotion,
      onReveal: hooks.onReveal,
      onPause: hooks.onPause,
    })
    longest = Math.max(longest, performance.now() - stepStarted)
    debugLog.log('info', `Built ${arrival.world}`, {
      ms: Math.round(performance.now() - started),
      longestStep: Math.round(longest),
      seed: arrival.seed,
      tier: arrival.tier,
    })
    const compiling = performance.now()
    await engine.prepare(stage)
    // Kept until the stage's own sky was compiled, which shares its shader.
    envSky.geometry.dispose()
    ;(envSky.material as THREE.Material).dispose()
    debugLog.log('info', `Compiled ${arrival.world}`, {
      ms: Math.round(performance.now() - compiling),
    })
    return stage
  }

  return {
    stats: engine.stats,
    get stage() {
      return current
    },
    showTitle() {
      forget()
      input.mode = 'menu'
      showWhenReady(
        new RideStage(engine.renderer, {
          seed: Math.floor(Math.random() * 1e9),
          level: engine.level,
          demo: true,
          reducedMotion: hooks.reducedMotion,
        }),
        'title',
      )
    },
    startRide(seed) {
      forget()
      input.mode = 'ride'
      showWhenReady(
        new RideStage(engine.renderer, {
          seed,
          level: engine.level,
          reducedMotion: hooks.reducedMotion,
          onEnter: hooks.onEnter,
          onArrive: hooks.onArrive,
          onPause: hooks.onPause,
          onRecenter: hooks.onRecenter,
        }),
        'ride',
      )
    },
    prepareWorld(arrival, found) {
      forget()
      prepared = { seed: arrival.seed, ready: prepare(arrival, found) }
    },
    async enterWorld(arrival, found) {
      const mine = generation
      const ready = prepared?.seed === arrival.seed ? prepared.ready : prepare(arrival, found)
      prepared = undefined
      let stage: WorldStage
      try {
        stage = await ready
      } catch (error) {
        debugLog.log('error', `Could not build ${arrival.world}: ${String(error)}`)
        return false
      }
      if (mine !== generation) {
        stage.dispose()
        return false
      }
      // The warp ends on a white screen: the first draw's work goes there, where nothing moves.
      const warming = performance.now()
      engine.warmUp(stage)
      debugLog.log('info', `Warmed up ${arrival.world}`, {
        ms: Math.round(performance.now() - warming),
      })
      input.mode = 'world'
      stage.publish()
      show(stage, `world ${arrival.world}`)
      return true
    },
    diagnostics() {
      return {
        quality: engine.level.name,
        pixelRatio: engine.stats.pixelRatio,
        devicePixelRatio: window.devicePixelRatio,
        canvas: `${canvas.width}×${canvas.height}`,
        screen: engine.label,
        // What the GPU holds: counts that grow from scene to scene would be a leak.
        geometries: engine.renderer.info.memory.geometries,
        textures: engine.renderer.info.memory.textures,
        programs: engine.renderer.info.programs?.length ?? 0,
      }
    },
    setPaused(paused) {
      engine.paused = paused
    },
    setQuality(next) {
      engine.setQuality(next)
    },
    thumbnail(itemId, shiny, size = 160) {
      const key = `${itemId}:${shiny}:${size}`
      const cached = thumbnails.get(key)
      if (cached) return cached
      const item = itemById(itemId)
      if (!item) return ''
      const renderer = engine.renderer
      const scene = new THREE.Scene()
      scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x403060, 1.6))
      const key1 = new THREE.DirectionalLight(0xffffff, 2.4)
      key1.position.set(2, 3, 4)
      scene.add(key1)
      const rim = new THREE.DirectionalLight(RARITY_COLORS[item.rarity], 3)
      rim.position.set(-3, 1, -3)
      scene.add(rim)
      const mesh = buildItem(item, shiny)
      mesh.rotation.set(0.35, -0.6, 0)
      scene.add(mesh)
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20)
      camera.position.set(0, 0.2, 2.6)
      camera.lookAt(0, 0, 0)
      const target = new THREE.WebGLRenderTarget(size, size, { samples: 4 })
      const before = renderer.getRenderTarget()
      const tone = renderer.toneMapping
      renderer.setRenderTarget(target)
      renderer.setClearColor(0x000000, 0)
      renderer.clear()
      renderer.render(scene, camera)
      const pixels = new Uint8Array(size * size * 4)
      renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
      renderer.setRenderTarget(before)
      renderer.toneMapping = tone
      const canvas2d = document.createElement('canvas')
      canvas2d.width = size
      canvas2d.height = size
      const context = canvas2d.getContext('2d')
      if (context) {
        const image = context.createImageData(size, size)
        // Render targets read bottom-up.
        for (let row = 0; row < size; row++)
          image.data.set(
            pixels.subarray((size - 1 - row) * size * 4, (size - row) * size * 4),
            row * size * 4,
          )
        context.putImageData(image, 0, 0)
      }
      const url = canvas2d.toDataURL('image/png')
      thumbnails.set(key, url)
      target.dispose()
      disposeItem(mesh)
      return url
    },
    dispose() {
      engine.dispose()
    },
  }
}
