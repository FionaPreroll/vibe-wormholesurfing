import * as THREE from 'three'
import { Expedition } from '../core/expedition'
import { itemById, type Reward } from '../core/rewards'
import type { RideOutcome } from '../core/ride'
import type { Arrival } from '../game/hud'
import type { Quality } from '../game/settings'
import type { ControlFrame, Input } from '../input/input'
import { Engine, type FrameStats } from './engine'
import { buildItem, disposeItem, RARITY_COLORS } from './models/items'
import { RideStage } from './ride/rideStage'
import { WorldStage } from './world/worldStage'

export interface DirectorHooks {
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
  enterWorld(arrival: Arrival, found: ReadonlySet<string>): void
  setPaused(paused: boolean): void
  setQuality(quality: Quality): void
  /** A picture of a treasure, as an image address, for the collection. */
  thumbnail(itemId: string, shiny: boolean, size?: number): string
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

  const show = (stage: RideStage | WorldStage) => {
    current = stage
    engine.setStage(stage)
  }

  return {
    stats: engine.stats,
    get stage() {
      return current
    },
    showTitle() {
      input.mode = 'menu'
      show(
        new RideStage(engine.renderer, {
          seed: Math.floor(Math.random() * 1e9),
          level: engine.level,
          demo: true,
          reducedMotion: hooks.reducedMotion,
        }),
      )
    },
    startRide(seed) {
      input.mode = 'ride'
      show(
        new RideStage(engine.renderer, {
          seed,
          level: engine.level,
          reducedMotion: hooks.reducedMotion,
          onArrive: hooks.onArrive,
          onPause: hooks.onPause,
          onRecenter: hooks.onRecenter,
        }),
      )
    },
    enterWorld(arrival, found) {
      input.mode = 'world'
      const expedition = new Expedition({
        world: arrival.world,
        seed: arrival.seed,
        tier: arrival.tier,
        distance: arrival.distance,
        found,
      })
      show(
        new WorldStage(engine.renderer, {
          expedition,
          level: engine.level,
          arrival,
          reducedMotion: hooks.reducedMotion,
          onReveal: hooks.onReveal,
          onPause: hooks.onPause,
        }),
      )
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
