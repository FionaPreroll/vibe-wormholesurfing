import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import type { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { type DebugLog, debugLog, percentile } from '../game/debugLog'
import type { Quality } from '../game/settings'
import type { ControlFrame, Input } from '../input/input'
import { disposeEnvironments } from './environments'
import { afterNextFrame } from './frames'
import { finishPass, type Look, sanitizePass } from './post'
import { ProbePass } from './probe'
import { levelOf, type QualityLevel } from './quality'
import { Resolution } from './resolution'
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

/** What the graphics chip and its WebGL can do, for the debug log. */
function graphicsInfo(gl: WebGL2RenderingContext | WebGLRenderingContext): Record<string, unknown> {
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    gpuVendor: info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    gpuRenderer: info
      ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER),
    webgl: gl.getParameter(gl.VERSION),
    shading: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxSamples: 'MAX_SAMPLES' in gl ? gl.getParameter(gl.MAX_SAMPLES) : 0,
    floatBuffers: gl.getExtension('EXT_color_buffer_float') !== null,
    halfFloatBuffers:
      gl.getExtension('EXT_color_buffer_half_float') !== null || 'MAX_SAMPLES' in gl,
  }
}

/** Frames per second over the last second, for the optional counter. */
export interface FrameStats {
  fps: number
  frameMs: number
  pixelRatio: number
  drawCalls: number
}

/** Milliseconds of shader compiling a frame may take while a stage is made ready. */
const PREPARE_BUDGET_MS = 8

/**
 * A frame later than this did not stall: the browser stopped drawing, as macOS does for a window
 * that is covered, while the page still counts as visible. The game's own longest stalls, such as
 * compiling shaders, stay well below it.
 */
const PAUSE_S = 3

/**
 * The renderer and its loop. It draws the current stage with bloom and a finishing pass, and
 * lowers the resolution while frames come late, raising it again once they are on time.
 *
 * Changing the canvas's size clears it, and a browser that shows the page before the next frame
 * is drawn shows it black. So every change of size waits for the next frame and happens right
 * before that frame is drawn.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer
  readonly software: boolean
  level: QualityLevel
  stage: Stage | undefined
  /** Where the game is, for the performance log: title, ride or a world. */
  label = 'title'
  /** While paused, the stage stands still but is still drawn. */
  paused = false
  readonly stats: FrameStats = { fps: 0, frameMs: 0, pixelRatio: 1, drawCalls: 0 }
  onFrame: ((dt: number, controls: ControlFrame) => void) | undefined

  #composer!: EffectComposer
  #renderPass!: RenderPass
  #bloom!: UnrealBloomPass
  #finish!: ShaderPass
  readonly #sceneProbe = new ProbePass()
  readonly #finalProbe = new ProbePass()
  #frame = 0
  #last = 0
  /** How sharp to draw, lower while frames come late (resolution.ts). */
  readonly #resolution = new Resolution()
  #sizeDirty = true
  #frameTimes: number[] = []
  #secondStart = 0
  #probeAt = 0
  #probeTurn = 0
  #lastBright = 1
  #lost = false
  readonly #observer: ResizeObserver
  readonly #log: DebugLog

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly input: Input,
    quality: Quality,
    log: DebugLog = debugLog,
  ) {
    this.#log = log
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
    const gl = this.renderer.getContext()
    this.software = rendersInSoftware(gl)
    this.level = levelOf(quality, this.software)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    // Draw calls and triangles add up over every pass of a frame, not just the last one.
    this.renderer.info.autoReset = false
    log.setEnvironment({ ...graphicsInfo(gl), softwareRendering: this.software })
    log.log('info', `Graphics started at quality ${this.level.name}`, { asked: quality })
    this.#sceneProbe.onReading = (reading) => {
      if (reading.broken > 0)
        log.log('glitch', 'Overflowing or broken pixels in the scene, cleaned before bloom', {
          share: reading.broken,
          screen: this.label,
        })
    }
    this.#finalProbe.onReading = (reading) => {
      if (reading.broken > 0 || (reading.brightness < 0.004 && this.#lastBright > 0.02))
        log.log('glitch', 'Black or broken frame', {
          brightness: Number(reading.brightness.toFixed(4)),
          broken: reading.broken,
          screen: this.label,
          pixelRatio: this.stats.pixelRatio,
        })
      this.#lastBright = reading.brightness
    }
    canvas.addEventListener('webglcontextlost', this.#onContextLost)
    canvas.addEventListener('webglcontextrestored', this.#onContextRestored)
    this.#build()
    this.#observer = new ResizeObserver(() => this.resize())
    this.#observer.observe(canvas)
  }

  readonly #onContextLost = (event: Event) => {
    // Asking for it back lets the browser restore the context instead of giving up on it.
    event.preventDefault()
    this.#lost = true
    this.#log.log('glitch', 'WebGL context lost', { screen: this.label })
  }

  readonly #onContextRestored = () => {
    this.#lost = false
    // Reflections rendered before the loss are gone with it.
    disposeEnvironments(this.renderer)
    this.#log.log('info', 'WebGL context restored')
    this.#build()
  }

  #build(): void {
    // The composer frees only its own two buffers: each pass holds its own, the bloom eleven.
    // The probes stay from build to build.
    for (const pass of this.#composer?.passes ?? []) {
      if (pass !== this.#sceneProbe && pass !== this.#finalProbe) pass.dispose()
    }
    this.#composer?.dispose()
    const level = this.level
    this.renderer.shadowMap.enabled = level.shadows > 0
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: level.samples,
    })
    this.#composer = new EffectComposer(this.renderer, target)
    this.#renderPass = new RenderPass(
      this.stage?.scene ?? new THREE.Scene(),
      this.stage?.camera ?? new THREE.PerspectiveCamera(),
    )
    this.#bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.55, 0.72)
    this.#finish = finishPass(level.radialBlur)
    this.#composer.addPass(this.#renderPass)
    this.#composer.addPass(this.#sceneProbe)
    this.#composer.addPass(sanitizePass())
    this.#composer.addPass(this.#bloom)
    this.#composer.addPass(this.#finish)
    this.#composer.addPass(this.#finalProbe)
    this.#composer.addPass(new OutputPass())
    this.#sizeDirty = true
  }

  setQuality(quality: Quality): void {
    const next = levelOf(quality, this.software)
    if (next.name === this.level.name) return
    this.#log.log('info', `Quality changed from ${this.level.name} to ${next.name}`)
    this.level = next
    this.#resolution.reset()
    this.#build()
    // Shadows on or off change how every material is built.
    this.stage?.scene.traverse((object) => {
      const material = (object as THREE.Mesh).material
      if (Array.isArray(material)) for (const entry of material) entry.needsUpdate = true
      else if (material) material.needsUpdate = true
    })
  }

  setStage(stage: Stage | undefined, label = this.label): void {
    const old = this.stage
    this.stage = stage
    this.label = label
    if (stage) {
      this.#renderPass.scene = stage.scene
      this.#renderPass.camera = stage.camera
      this.#sizeDirty = true
      this.#resolution.newScreen()
    }
    old?.dispose()
    this.#log.log('info', `Showing ${label}`)
  }

  /**
   * Compiles a stage's shaders before it shows, without stalling frames. With
   * KHR_parallel_shader_compile, three.js hands them all to the driver, which compiles them
   * alongside, and the promise resolves once they are ready. Without it, a driver compiles at the
   * first question about a program, all queued programs at once, in one long frame: so a few
   * objects go at a time instead, each new program finished at once, a few milliseconds a frame.
   */
  prepare(stage: Stage): Promise<void> {
    return this.compile(stage.scene, stage.camera)
  }

  /** Compiles the shaders of any scene so, as `prepare` does a stage's. */
  async compile(scene: THREE.Scene, camera: THREE.Camera): Promise<void> {
    if (this.renderer.extensions.has('KHR_parallel_shader_compile')) {
      await this.#intoComposer(() => this.renderer.compileAsync(scene, camera))
      return
    }
    const objects: THREE.Object3D[] = []
    scene.traverse((object) => {
      if ('material' in object && object.material) objects.push(object)
    })
    let started = performance.now()
    for (const object of objects) {
      const materials = this.#intoComposer(() => this.renderer.compile(object, camera, scene))
      for (const material of materials) {
        const properties = this.renderer.properties.get(material) as {
          currentProgram?: { getUniforms(): unknown }
        }
        properties.currentProgram?.getUniforms()
      }
      if (performance.now() - started > PREPARE_BUDGET_MS) {
        await afterNextFrame()
        started = performance.now()
      }
    }
  }

  /**
   * Draws a stage once into the composer's buffer before it shows, every object of it, the culled
   * ones too: its geometry and textures go to the graphics chip, its shadow map is made, and the
   * driver builds its pipelines, which some build only at a first draw (Metal, SwiftShader).
   * Done while the screen is white at the end of a warp, that stall shows nothing moving.
   */
  warmUp(stage: Stage): void {
    const culled: THREE.Object3D[] = []
    stage.scene.traverse((object) => {
      if (object.frustumCulled) {
        object.frustumCulled = false
        culled.push(object)
      }
    })
    try {
      this.#intoComposer(() => this.renderer.render(stage.scene, stage.camera))
    } finally {
      for (const object of culled) object.frustumCulled = true
    }
  }

  /**
   * Runs `make` with the composer's buffer bound. The scene draws into it, not to the screen,
   * which decides how its shaders are built (no tone mapping, linear color): built otherwise,
   * the first frame would build them all again.
   */
  #intoComposer<T>(make: () => T): T {
    const previous = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(this.#composer.readBuffer)
    try {
      return make()
    } finally {
      this.renderer.setRenderTarget(previous)
    }
  }

  /** Asks for the canvas to take its size again before the next frame. */
  resize(): void {
    this.#sizeDirty = true
  }

  #applySize(): void {
    this.#sizeDirty = false
    const width = Math.max(1, this.canvas.clientWidth)
    const height = Math.max(1, this.canvas.clientHeight)
    const ratio =
      Math.min(window.devicePixelRatio || 1, this.level.maxPixelRatio) * this.#resolution.scale
    const pixelRatio = Math.max(0.5, ratio)
    this.stats.pixelRatio = Number(pixelRatio.toFixed(2))
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
    this.#secondStart = this.#last
    const loop = (now: number) => {
      this.#frame = requestAnimationFrame(loop)
      const raw = (now - this.#last) / 1000
      this.#last = now
      const resumed = raw > PAUSE_S
      if (resumed) {
        // The browser stopped drawing for a while, as it does for a window that is covered or on
        // another desktop: not a stall of the game. The second being counted starts afresh.
        this.#log.log('info', `Drawing paused for ${raw.toFixed(1)} s`, { screen: this.label })
        this.#frameTimes = []
        this.#secondStart = now
      } else if (raw > 0.25 && document.visibilityState === 'visible')
        this.#log.log('glitch', `Long frame: ${Math.round(raw * 1000)} ms`, { screen: this.label })
      this.#tick(Math.min(0.1, Math.max(0, raw)), now, resumed ? undefined : raw)
    }
    this.#frame = requestAnimationFrame(loop)
  }

  stop(): void {
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
  }

  /** `raw` is the frame's real time, left out after a pause so it does not count as a frame. */
  #tick(dt: number, now: number, raw: number | undefined): void {
    const controls = this.input.frame(dt)
    this.onFrame?.(dt, controls)
    const stage = this.stage
    if (!stage || this.#lost) return
    if (!this.paused) stage.update(dt, controls)
    this.#applyLook(stage, now)
    if (this.#sizeDirty) this.#applySize()
    if (now >= this.#probeAt) {
      // One probe per turn, each every few seconds.
      this.#probeAt = now + 1500
      this.#probeTurn = 1 - this.#probeTurn
      if (this.#probeTurn === 0) this.#sceneProbe.due = true
      else this.#finalProbe.due = true
    }
    this.renderer.info.reset()
    this.#composer.render(dt)
    if (raw !== undefined) this.#measure(raw, now)
    this.#adapt(dt)
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

  /** Sums up each second of frames for the counter and the debug log. */
  #measure(raw: number, now: number): void {
    this.#frameTimes.push(raw * 1000)
    if (now - this.#secondStart < 1000) return
    const times = this.#frameTimes
    const seconds = (now - this.#secondStart) / 1000
    this.#frameTimes = []
    this.#secondStart = now
    const average = times.reduce((sum, time) => sum + time, 0) / Math.max(1, times.length)
    const info = this.renderer.info
    this.stats.fps = Math.round(times.length / seconds)
    this.stats.frameMs = Number(average.toFixed(1))
    this.stats.drawCalls = info.render.calls
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    this.#log.sample({
      t: Math.round(now),
      screen: this.label,
      fps: this.stats.fps,
      frameAvg: this.stats.frameMs,
      frameP95: Number(percentile(times, 0.95).toFixed(1)),
      frameMax: Number(Math.max(...times).toFixed(1)),
      pixelRatio: this.stats.pixelRatio,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      ...(memory ? { heapMB: Math.round(memory.usedJSHeapSize / 1048576) } : {}),
    })
  }

  /**
   * Lowers the resolution while frames come late, and raises it once they are quick again. A
   * resolution that had to come down holds for a while, so it does not swing up and down.
   */
  #adapt(dt: number): void {
    if (this.paused || dt <= 0) return
    const change = this.#resolution.frame(dt, performance.now() / 1000, this.stats.fps)
    if (!change) return
    this.#sizeDirty = true
    const message = {
      lowered: 'Resolution lowered',
      raised: 'Resolution raised',
      kept: 'Resolution raised again: lowering it did not help',
    }[change.kind]
    this.#log.log('info', message, { ...change, screen: this.label })
  }

  dispose(): void {
    this.stop()
    this.#observer.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.#onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.#onContextRestored)
    this.stage?.dispose()
    this.stage = undefined
    this.#composer.dispose()
    this.#sceneProbe.dispose()
    this.#finalProbe.dispose()
    disposeEnvironments(this.renderer)
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
