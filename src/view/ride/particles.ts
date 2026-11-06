import * as THREE from 'three'
import { uniform } from '../uniforms'
import { BEND_GLSL } from './bend'
import type { RideUniforms } from './tunnel'

const LOOP = 420

/** Specks of glowing dust that rush past: the clearest sense of speed. */
export function buildDust(uniforms: RideUniforms, count: number): THREE.Points {
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 2 + Math.sqrt(Math.random()) * 17
    positions.set(
      [Math.cos(angle) * radius, Math.sin(angle) * radius, Math.random() * LOOP],
      index * 3,
    )
    seeds[index] = Math.random()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uPixel: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      ${BEND_GLSL}
      uniform float uTravel;
      uniform float uTime;
      uniform float uPixel;
      attribute float aSeed;
      varying vec3 vColor;
      varying float vFade;
      void main() {
        float depth = mod(position.z - uTravel * (0.9 + aSeed * 0.2), ${LOOP.toFixed(1)}) - 20.0;
        vec3 p = vec3(position.xy, -depth);
        p.xy += bendAt(depth);
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        float size = mix(0.025, 0.09, aSeed * aSeed);
        gl_PointSize = min(18.0, size * uPixel * 700.0 / max(1.0, -view.z));
        vFade = smoothstep(-5.0, 25.0, depth) * (1.0 - smoothstep(250.0, 400.0, depth));
        float twinkle = 0.7 + 0.3 * sin(uTime * (2.0 + aSeed * 5.0) + aSeed * 40.0);
        vColor = mix(vec3(0.6, 0.75, 1.0), vec3(1.0, 0.7, 0.95), fract(aSeed * 7.13)) * twinkle;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vFade;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(vColor * glow * glow * vFade * 1.2, glow * vFade);
      }
    `,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  return points
}

/** Long streaks of light along the walls that stretch with speed. */
export function buildStreaks(uniforms: RideUniforms, count: number): THREE.LineSegments {
  const positions = new Float32Array(count * 2 * 3)
  const ends = new Float32Array(count * 2)
  const seeds = new Float32Array(count * 2)
  for (let index = 0; index < count; index++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 4 + Math.random() * 14
    const z = Math.random() * LOOP
    const seed = Math.random()
    for (let end = 0; end < 2; end++) {
      positions.set([Math.cos(angle) * radius, Math.sin(angle) * radius, z], (index * 2 + end) * 3)
      ends[index * 2 + end] = end
      seeds[index * 2 + end] = seed
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      ${BEND_GLSL}
      uniform float uTravel;
      uniform float uSpeed;
      attribute float aEnd;
      attribute float aSeed;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        float head = mod(position.z - uTravel * 1.2, ${LOOP.toFixed(1)}) - 20.0;
        float length = (6.0 + aSeed * 18.0) * uSpeed * uSpeed;
        float depth = head + aEnd * length;
        vec3 p = vec3(position.xy, -depth);
        p.xy += bendAt(depth);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        float fade = smoothstep(0.0, 30.0, head) * (1.0 - smoothstep(200.0, 360.0, head));
        vAlpha = (1.0 - aEnd) * fade * smoothstep(0.8, 1.6, uSpeed) * (0.1 + aSeed * 0.3);
        vColor = mix(vec3(0.45, 0.8, 1.0), vec3(0.95, 0.55, 1.0), aSeed);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor * vAlpha * 2.0, vAlpha);
      }
    `,
  })
  const lines = new THREE.LineSegments(geometry, material)
  lines.frustumCulled = false
  return lines
}

/**
 * Sparks thrown out by events: each burst sends particles flying from a point; they slow, fade
 * and drift back with the ride.
 */
export class Bursts {
  readonly points: THREE.Points
  readonly #positions: Float32Array
  readonly #colors: Float32Array
  readonly #sizes: Float32Array
  readonly #velocity: Float32Array
  readonly #life: Float32Array
  readonly #maxLife: Float32Array
  #next = 0

  constructor(readonly capacity = 700) {
    this.#positions = new Float32Array(capacity * 3)
    this.#colors = new Float32Array(capacity * 3)
    this.#sizes = new Float32Array(capacity)
    this.#velocity = new Float32Array(capacity * 3)
    this.#life = new Float32Array(capacity)
    this.#maxLife = new Float32Array(capacity).fill(1)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.#positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.#colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.#sizes, 1))
    const material = new THREE.ShaderMaterial({
      uniforms: { uPixel: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uPixel;
        attribute float aSize;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * view;
          gl_PointSize = min(36.0 * uPixel, aSize * uPixel * 600.0 / max(0.5, -view.z));
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          gl_FragColor = vec4(vColor * glow * glow * 2.5, glow);
        }
      `,
    })
    this.points = new THREE.Points(geometry, material)
    this.points.frustumCulled = false
  }

  emit(
    at: THREE.Vector3,
    count: number,
    color: THREE.Color,
    { speed = 8, size = 0.25, life = 0.9, spread = 1 } = {},
  ): void {
    for (let i = 0; i < count; i++) {
      const index = this.#next
      this.#next = (this.#next + 1) % this.capacity
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const v = speed * (0.4 + Math.random() * 0.6)
      this.#positions.set([at.x, at.y, at.z], index * 3)
      this.#velocity.set(
        [
          Math.sin(phi) * Math.cos(theta) * v * spread,
          Math.sin(phi) * Math.sin(theta) * v * spread,
          Math.cos(phi) * v,
        ],
        index * 3,
      )
      const tint = 0.8 + Math.random() * 0.4
      this.#colors.set([color.r * tint, color.g * tint, color.b * tint], index * 3)
      this.#sizes[index] = size * (0.5 + Math.random())
      const span = life * (0.6 + Math.random() * 0.6)
      this.#life[index] = span
      this.#maxLife[index] = span
    }
  }

  /** Moves the particles; `drift` carries them back along z, as the ride carries everything. */
  update(dt: number, drift = 0): void {
    const damping = Math.exp(-2.5 * dt)
    for (let index = 0; index < this.capacity; index++) {
      const life = this.#life[index] as number
      if (life <= 0) continue
      const next = life - dt
      this.#life[index] = next
      const base = index * 3
      for (let axis = 0; axis < 3; axis++) {
        const v = (this.#velocity[base + axis] as number) * damping
        this.#velocity[base + axis] = v
        this.#positions[base + axis] = (this.#positions[base + axis] as number) + v * dt
      }
      this.#positions[base + 2] = (this.#positions[base + 2] as number) + drift * dt
      if (next <= 0) this.#sizes[index] = 0
      else {
        const fade = next / (this.#maxLife[index] as number)
        this.#colors[base] = (this.#colors[base] as number) * (0.96 + fade * 0.04)
        this.#colors[base + 1] = (this.#colors[base + 1] as number) * (0.96 + fade * 0.04)
        this.#colors[base + 2] = (this.#colors[base + 2] as number) * (0.96 + fade * 0.04)
      }
    }
    const geometry = this.points.geometry
    ;(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true
  }

  setPixelRatio(ratio: number): void {
    uniform((this.points.material as THREE.ShaderMaterial).uniforms, 'uPixel').value = ratio
  }
}
