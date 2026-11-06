import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import type { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import type { Quality } from '../game/settings'
import type { ControlFrame, Input } from '../input/input'
import { finishPass, type Look, sanitizePass } from './post'
import { levelOf, type QualityLevel } from './quality'
import { uniform } from './uniforms'

/** A scene the engine shows: it moves its things and its camera on every frame. */
export interface Stage {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly look: Look
  update(dt: number, controls: ControlFrame): void
  dispose(): void
}

/** Whether WebGL draws without a graphics card, as headless test browsers do. */
export function rendersInSoftware(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
  return /swiftshader|llvmpipe|software|basic render/i.test(name)
}

/** Frames per second over the last second, for the optional counter. */
export interface FrameStats {
  fps: number
  pixelRatio: number
}

/**
 * The renderer and its loop. It draws the current stage with bloom and a finishing pass, and
 * lowers the resolution while frames come late, raising it again once they are on time.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer
  readonly software: boolean
  level: QualityLevel
  stage: Stage | undefined
  /** While paused, the stage stands still but is still drawn. */
  paused = false
  readonly stats: FrameStats = { fps: 0, pixelRatio: 1 }
  onFrame: ((dt: number, controls: ControlFrame) => void) | undefined

  #composer!: EffectComposer
  #renderPass!: RenderPass
  #bloom!: UnrealBloomPass
  #finish!: ShaderPass
  #frame = 0
  #last = 0
  #scale = 1
  #slow = 0
  #fast = 0
  #frames = 0
  #fpsTime = 0
  readonly #observer: ResizeObserver

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly input: Input,
    quality: Quality,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
    this.software = rendersInSoftware(this.renderer.getContext())
    this.level = levelOf(quality, this.software)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.#build()
    this.#observer = new ResizeObserver(() => this.resize())
    this.#observer.observe(canvas)
    this.resize()
  }

  #build(): void {
    this.#composer?.dispose()
    const level = this.level
    this.renderer.shadowMap.enabled = level.shadows > 0
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: level.samples,
    })
    this.#composer = new EffectComposer(this.renderer, target)
    this.#renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera())
    this.#bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.55, 0.72)
    this.#finish = finishPass(level.radialBlur)
    this.#composer.addPass(this.#renderPass)
    this.#composer.addPass(sanitizePass())
    this.#composer.addPass(this.#bloom)
    this.#composer.addPass(this.#finish)
    this.#composer.addPass(new OutputPass())
  }

  setQuality(quality: Quality): void {
    const next = levelOf(quality, this.software)
    if (next.name === this.level.name) return
    this.level = next
    this.#scale = 1
    this.#build()
    this.resize()
  }

  setStage(stage: Stage | undefined): void {
    const old = this.stage
    this.stage = stage
    if (stage) {
      this.#renderPass.scene = stage.scene
      this.#renderPass.camera = stage.camera
      this.resize()
    }
    old?.dispose()
  }

  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth)
    const height = Math.max(1, this.canvas.clientHeight)
    const ratio = Math.min(window.devicePixelRatio || 1, this.level.maxPixelRatio) * this.#scale
    const pixelRatio = Math.max(0.5, ratio)
    this.stats.pixelRatio = pixelRatio
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    this.#composer.setPixelRatio(pixelRatio)
    this.#composer.setSize(width, height)
    const camera = this.stage?.camera
    if (camera) {
      camera.aspect = width / height
      applyFov(camera, (camera.userData.baseFov as number | undefined) ?? camera.fov)
    }
    uniform(this.#finish.uniforms, 'uAspect').value = width / height
  }

  start(): void {
    if (this.#frame) return
    this.#last = performance.now()
    const loop = (now: number) => {
      this.#frame = requestAnimationFrame(loop)
      const dt = Math.min(0.1, Math.max(0, (now - this.#last) / 1000))
      this.#last = now
      this.#tick(dt, now)
    }
    this.#frame = requestAnimationFrame(loop)
  }

  stop(): void {
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
  }

  #tick(dt: number, now: number): void {
    const controls = this.input.frame(dt)
    this.onFrame?.(dt, controls)
    const stage = this.stage
    if (!stage) return
    if (!this.paused) stage.update(dt, controls)
    this.#applyLook(stage, now)
    this.#composer.render(dt)
    this.#adapt(dt, now)
  }

  #applyLook(stage: Stage, now: number): void {
    const look = stage.look
    this.#bloom.strength = look.bloom
    this.#bloom.radius = look.bloomRadius
    this.#bloom.threshold = look.bloomThreshold
    this.renderer.toneMappingExposure = look.exposure
    const uniforms = this.#finish.uniforms
    uniform(uniforms, 'uAberration').value = look.aberration
    uniform(uniforms, 'uBlur').value = look.radialBlur
    uniform(uniforms, 'uVignette').value = look.vignette
    uniform(uniforms, 'uGrain').value = look.grain
    uniform(uniforms, 'uFlash').value = look.flash
    uniform(uniforms, 'uFlashColor').value.copy(look.flashColor)
    uniform(uniforms, 'uSaturation').value = look.saturation
    uniform(uniforms, 'uTime').value = now / 1000
  }

  /** Lowers the resolution while frames come late, and raises it once they are quick again. */
  #adapt(dt: number, now: number): void {
    this.#frames++
    if (now - this.#fpsTime >= 1000) {
      this.stats.fps = Math.round((this.#frames * 1000) / (now - this.#fpsTime))
      this.#frames = 0
      this.#fpsTime = now
    }
    if (this.paused || dt <= 0) return
    if (dt > 1 / 45) {
      this.#slow += dt
      this.#fast = 0
    } else if (dt < 1 / 57) {
      this.#fast += dt
      this.#slow = Math.max(0, this.#slow - dt * 0.5)
    }
    if (this.#slow > 0.8 && this.#scale > 0.55) {
      this.#scale = Math.max(0.55, this.#scale - 0.12)
      this.#slow = 0
      this.resize()
    } else if (this.#fast > 4 && this.#scale < 1) {
      this.#scale = Math.min(1, this.#scale + 0.08)
      this.#fast = 0
      this.resize()
    }
  }

  dispose(): void {
    this.stop()
    this.#observer.disconnect()
    this.stage?.dispose()
    this.stage = undefined
    this.#composer.dispose()
    this.renderer.dispose()
  }
}

/**
 * Sets a camera's view angle. Narrow screens keep the view across that `base` gives at 16:9:
 * the vertical angle widens instead, so a phone held upright still sees the whole tunnel.
 */
export function applyFov(camera: THREE.PerspectiveCamera, base: number): void {
  camera.userData.baseFov = base
  const fov = fovFor(base, camera.aspect)
  if (Math.abs(camera.fov - fov) > 1e-4) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
}

/** A vertical field of view that keeps at least the horizontal view of `base` at 16:9. */
export function fovFor(base: number, aspect: number): number {
  const wide = 16 / 9
  if (aspect >= wide) return base
  const horizontal = 2 * Math.atan(Math.tan((base * Math.PI) / 360) * wide)
  const vertical = 2 * Math.atan(Math.tan(horizontal / 2) / aspect)
  return Math.min(100, (vertical * 180) / Math.PI)
}
