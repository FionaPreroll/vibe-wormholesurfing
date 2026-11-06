import * as THREE from 'three'
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js'
import { uniform } from './uniforms'

const SIZE = 4

export interface ProbeReading {
  /** Average brightness after a simple tone curve, 0 to 1. */
  readonly brightness: number
  /** Share of the sampled pixels that were not finite numbers. */
  readonly broken: number
}

/**
 * Looks at the picture between two passes now and then, without changing it: it samples a grid
 * of pixels into a tiny target and reads them back, to catch black or broken frames for the
 * debug log. Reading back stalls the graphics chip a moment, so it only looks when asked.
 */
export class ProbePass extends Pass {
  due = false
  onReading: ((reading: ProbeReading) => void) | undefined
  readonly #target = new THREE.WebGLRenderTarget(SIZE, SIZE)
  readonly #pixels = new Uint8Array(SIZE * SIZE * 4)
  readonly #quad: FullScreenQuad
  readonly #material: THREE.ShaderMaterial

  constructor() {
    super()
    this.needsSwap = false
    this.#material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          vec3 color = texture2D(tDiffuse, vUv).rgb;
          bool broken = any(isnan(color)) || any(isinf(color));
          float light = dot(max(color, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor = vec4(vec3(broken ? 0.0 : light / (1.0 + light)), broken ? 1.0 : 0.0);
        }
      `,
    })
    this.#quad = new FullScreenQuad(this.#material)
  }

  override render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    if (!this.due) return
    this.due = false
    uniform(this.#material.uniforms, 'tDiffuse').value = readBuffer.texture
    const before = renderer.getRenderTarget()
    renderer.setRenderTarget(this.#target)
    this.#quad.render(renderer)
    renderer.readRenderTargetPixels(this.#target, 0, 0, SIZE, SIZE, this.#pixels)
    renderer.setRenderTarget(before)
    let light = 0
    let broken = 0
    for (let index = 0; index < SIZE * SIZE; index++) {
      light += (this.#pixels[index * 4] ?? 0) / 255
      if ((this.#pixels[index * 4 + 3] ?? 0) > 127) broken++
    }
    this.onReading?.({ brightness: light / (SIZE * SIZE), broken: broken / (SIZE * SIZE) })
  }

  override dispose(): void {
    this.#target.dispose()
    this.#material.dispose()
    this.#quad.dispose()
  }
}
