import * as THREE from 'three'
import { uniform } from '../uniforms'

/**
 * A ribbon of light behind a moving point. Its points flow backward with the ride, so the ribbon
 * draws the ship's path through the tunnel.
 */
export class Trail {
  readonly mesh: THREE.Mesh
  readonly #points: THREE.Vector3[]
  readonly #positions: Float32Array
  readonly #alphas: Float32Array

  constructor(
    readonly length = 26,
    readonly width = 0.12,
    color: THREE.Color,
  ) {
    this.#points = Array.from({ length }, () => new THREE.Vector3())
    this.#positions = new Float32Array(length * 2 * 3)
    this.#alphas = new Float32Array(length * 2)
    const indices: number[] = []
    for (let index = 0; index < length - 1; index++) {
      const a = index * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    for (let index = 0; index < length; index++) {
      const fade = 1 - index / (length - 1)
      this.#alphas[index * 2] = fade
      this.#alphas[index * 2 + 1] = fade
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.#positions, 3))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.#alphas, 1))
    geometry.setIndex(indices)
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: color }, uPower: { value: 1 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aAlpha;
          varying float vAlpha;
          void main() {
            vAlpha = aAlpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uPower;
          varying float vAlpha;
          void main() {
            float a = vAlpha * vAlpha * uPower;
            gl_FragColor = vec4(uColor * a * 1.1, a);
          }
        `,
      }),
    )
    this.mesh.frustumCulled = false
  }

  reset(at: THREE.Vector3): void {
    for (const point of this.#points) point.copy(at)
  }

  /**
   * Adds the newest point at `head`. The older ones keep where the head was across, and trail
   * behind it at `spacing` apart, so the ribbon draws the last moments of the ship's swerves.
   */
  update(head: THREE.Vector3, spacing: number, power: number): void {
    const points = this.#points
    for (let index = points.length - 1; index > 0; index--)
      (points[index] as THREE.Vector3).copy(points[index - 1] as THREE.Vector3)
    ;(points[0] as THREE.Vector3).copy(head)
    for (const [index, point] of points.entries()) {
      const w = this.width * (1 - index / points.length)
      const z = head.z + index * spacing
      this.#positions.set([point.x, point.y + w, z], index * 6)
      this.#positions.set([point.x, point.y - w, z], index * 6 + 3)
    }
    const geometry = this.mesh.geometry
    ;(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    uniform((this.mesh.material as THREE.ShaderMaterial).uniforms, 'uPower').value = power
  }
}
