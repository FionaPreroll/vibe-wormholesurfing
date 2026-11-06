import * as THREE from 'three'
import type { HoleColor, HoleTier } from '../../core/holes'
import { glowSprite } from '../glow'
import { HASH, SIMPLEX3 } from '../glsl'
import { uniform } from '../uniforms'

/** The colors of holes in light: bright enough to bloom. */
export const HOLE_LIGHT: Readonly<Record<HoleColor, THREE.Color>> = {
  red: new THREE.Color(1.0, 0.22, 0.34),
  blue: new THREE.Color(0.2, 0.5, 1.0),
  green: new THREE.Color(0.2, 1.0, 0.55),
  yellow: new THREE.Color(1.0, 0.82, 0.2),
  white: new THREE.Color(0.95, 0.95, 1.0),
}

const BILLBOARD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const HOLE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uWhite;
uniform float uPull;
uniform float uFade;
uniform float uSeed;
varying vec2 vUv;
${SIMPLEX3}
vec3 rainbow(float t) {
  return 0.6 + 0.4 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67)));
}
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p) * 1.5;
  float a = atan(p.y, p.x);
  float t = uTime + uSeed * 10.0;
  float swirl = a + 0.7 / (r + 0.3) + t * (0.5 + uPull);
  float rays = snoise(vec3(cos(swirl) * 2.2, sin(swirl) * 2.2, r * 2.5 - t * 1.4));
  float spokes = pow(abs(sin(a * 9.0 + snoise(vec3(p * 2.5, t * 0.35)) * 2.2)), 24.0);
  float core = exp(-r * r * 11.0);
  vec3 body = mix(uColor, rainbow(a / 6.2831853 + t * 0.1 + r * 0.5), uWhite * 0.75);
  vec3 color = body * (0.55 + 0.35 * smoothstep(1.0, 0.3, r));
  color += body * max(rays, 0.0) * 0.45 * smoothstep(1.0, 0.25, r);
  color += mix(body, vec3(1.0), 0.5) * spokes * smoothstep(1.0, 0.2, r) * 0.55;
  color = mix(color, vec3(1.5), core);

  float edge = 1.0 + snoise(vec3(cos(a) * 1.5, sin(a) * 1.5, t * 0.6)) * 0.04;
  float inside = smoothstep(0.98 * edge, 0.86 * edge, r);
  float smoke = snoise(vec3(cos(swirl) * 3.0, sin(swirl) * 3.0, t * 0.5 + r)) * 0.12;
  float rimOuter = 1.42 + uPull * 0.35;
  float rim = 1.0 - smoothstep(0.95 * edge, rimOuter + smoke, r);
  vec3 dark = vec3(0.01, 0.0, 0.03);
  vec3 lip = body * 0.9 * smoothstep(1.12, 0.95, r);
  vec3 outside = dark + lip;
  vec3 finalColor = mix(outside, color, inside);
  float alpha = max(inside, rim * 0.96) * uFade;
  gl_FragColor = vec4(finalColor, alpha);
}
`

const FLOWER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uFade;
varying vec2 vUv;
vec3 rainbow(float t) {
  return 0.6 + 0.4 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67)));
}
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float a = atan(p.y, p.x) + uTime * 0.25;
  float petals = 0.55 + 0.4 * pow(abs(cos(a * 3.0)), 0.7);
  float inner = 0.3 + 0.22 * pow(abs(cos(a * 3.0 + 1.5708)), 0.7);
  float glow = smoothstep(petals, petals - 0.22, r) * smoothstep(0.18, 0.35, r);
  float glow2 = smoothstep(inner + 0.2, inner, r) * 0.6;
  float edge = smoothstep(petals - 0.02, petals - 0.07, r) - smoothstep(petals - 0.07, petals - 0.15, r);
  vec3 color = mix(vec3(1.0, 0.55, 0.85), vec3(1.0, 0.85, 0.4), 0.5 + 0.5 * cos(a * 2.0 + uTime));
  color = mix(color, rainbow(r - uTime * 0.2), 0.3);
  float alpha = (glow * 0.3 + glow2 * 0.5 + edge * 0.8) * uFade;
  gl_FragColor = vec4(color * alpha * 0.9, alpha);
}
`

const ORB_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const ORB_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vLocal;
${SIMPLEX3}
void main() {
  float facing = max(dot(normalize(vNormal), normalize(vView)), 0.0);
  float fresnel = pow(1.0 - facing, 2.2);
  float swirl = snoise(vLocal * 2.4 + vec3(0.0, uTime * 1.3, uTime * 0.7));
  vec3 color = mix(uColor * 1.1, vec3(2.0, 1.85, 1.5), pow(facing, 3.0));
  color += uColor * max(swirl, 0.0) * 0.6;
  color += vec3(1.3, 0.8, 0.4) * fresnel * 1.2;
  gl_FragColor = vec4(color, 1.0);
}
`

const SPARK_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uFade;
varying vec2 vUv;
${SIMPLEX3}
${HASH}
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = uTime * 1.0 + uSeed * 13.0;
  float flicker = step(0.3, hash12(vec2(floor(t * 18.0), uSeed)));
  float arcs = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float n = snoise(vec3(cos(a) * (1.5 + fi), sin(a) * (1.5 + fi), r * 3.0 - t * 6.0 + fi * 7.0));
    arcs += pow(1.0 - abs(n), 14.0) * (0.6 + 0.4 * flicker);
  }
  arcs *= smoothstep(1.0, 0.25, r);
  float core = exp(-r * r * 18.0);
  float haze = exp(-r * r * 3.5) * 0.35;
  vec3 color = vec3(0.5, 0.75, 1.0) * arcs * 1.6 + vec3(1.6, 1.8, 2.1) * core + vec3(0.45, 0.3, 1.0) * haze;
  float alpha = clamp(arcs + core + haze, 0.0, 1.0) * uFade;
  gl_FragColor = vec4(color * uFade, alpha);
}
`

function billboard(
  size: number,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  blending: THREE.Blending,
) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BILLBOARD_VERTEX,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending,
    }),
  )
  mesh.frustumCulled = false
  return mesh
}

/** A warp hole: a glowing disc with a dark rim, halos for rarer tiers and a flower for the rarest. */
export class HoleView {
  readonly group = new THREE.Group()
  readonly #disc: THREE.Mesh
  readonly #halos: THREE.Mesh[] = []
  readonly #flower: THREE.Mesh | undefined
  readonly #light: THREE.Sprite
  readonly #spin = Math.random() * 10

  constructor(
    readonly color: HoleColor,
    readonly tier: HoleTier,
    readonly radius: number,
  ) {
    const light = HOLE_LIGHT[color]
    this.#disc = billboard(
      radius * 3,
      HOLE_FRAGMENT,
      {
        uColor: { value: light.clone() },
        uTime: { value: 0 },
        uWhite: { value: color === 'white' ? 1 : 0 },
        uPull: { value: 0 },
        uFade: { value: 0 },
        uSeed: { value: Math.random() },
      },
      THREE.NormalBlending,
    )
    this.#disc.renderOrder = 2
    this.#light = glowSprite(light, radius * 5, 0.14)
    this.#light.renderOrder = 1
    this.group.add(this.#light)
    if (tier === 4) {
      this.#flower = billboard(
        radius * 4.6,
        FLOWER_FRAGMENT,
        { uTime: { value: 0 }, uFade: { value: 0 } },
        THREE.AdditiveBlending,
      )
      this.#flower.renderOrder = 1
      this.group.add(this.#flower)
    }
    this.group.add(this.#disc)
    const halos = tier >= 3 ? 2 : tier === 2 ? 1 : 0
    for (let index = 0; index < halos; index++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * (1.3 + index * 0.32), 0.045 + index * 0.01, 8, 120),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(1.0, 0.62, 0.22).multiplyScalar(1.6),
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      )
      ring.renderOrder = 3
      const glow = new THREE.Mesh(
        new THREE.TorusGeometry(radius * (1.3 + index * 0.32), 0.22, 8, 90),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(1.0, 0.55, 0.2),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      ring.add(glow)
      this.#halos.push(ring)
      this.group.add(ring)
    }
  }

  update(time: number, camera: THREE.Camera, fade: number, pull: number): void {
    this.#disc.quaternion.copy(camera.quaternion)
    const material = this.#disc.material as THREE.ShaderMaterial
    uniform(material.uniforms, 'uTime').value = time
    uniform(material.uniforms, 'uFade').value = fade
    uniform(material.uniforms, 'uPull').value = pull
    ;(this.#light.material as THREE.SpriteMaterial).opacity = 0.14 * fade
    if (this.#flower) {
      this.#flower.quaternion.copy(camera.quaternion)
      const flower = this.#flower.material as THREE.ShaderMaterial
      uniform(flower.uniforms, 'uTime').value = time
      uniform(flower.uniforms, 'uFade').value = fade
    }
    for (const [index, ring] of this.#halos.entries()) {
      const t = time * (0.5 + index * 0.25) + this.#spin
      ring.rotation.set(1.1 + Math.sin(t * 0.7) * 0.35, t * (index ? -1 : 1), index * 0.8)
      const pulse = 0.85 + Math.sin(time * 3 + index) * 0.15
      ;(ring.material as THREE.MeshBasicMaterial).opacity = fade * pulse
      ;((ring.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
        fade * 0.12 * pulse
    }
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        ;(object.material as THREE.Material).dispose()
      } else if (object instanceof THREE.Sprite) object.material.dispose()
    })
  }
}

/** Shared pieces of orbs and sparks, made once per ride. */
export class ThingKit {
  readonly orbGeometry = new THREE.SphereGeometry(0.62, 32, 20)
  readonly orbMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.55, 0.12) } },
    vertexShader: ORB_VERTEX,
    fragmentShader: ORB_FRAGMENT,
  })
  readonly spikeGeometry: THREE.BufferGeometry
  readonly spikeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a0f33,
    emissive: 0x4030ff,
    emissiveIntensity: 0.6,
    metalness: 0.6,
    roughness: 0.3,
    flatShading: true,
  })

  constructor() {
    const spikes = new THREE.IcosahedronGeometry(0.42, 1)
    const position = spikes.getAttribute('position') as THREE.BufferAttribute
    const point = new THREE.Vector3()
    // Every vertex shared by five faces becomes a spike.
    for (let index = 0; index < position.count; index++) {
      point.fromBufferAttribute(position, index)
      const length = point.length()
      const sharp = Math.abs(point.x) + Math.abs(point.y) + Math.abs(point.z)
      if (sharp % 0.2 < 0.1) point.multiplyScalar(1.7 / Math.max(1, length * 2))
      position.setXYZ(index, point.x, point.y, point.z)
    }
    spikes.computeVertexNormals()
    this.spikeGeometry = spikes
  }

  makeOrb(): THREE.Group {
    const group = new THREE.Group()
    const ball = new THREE.Mesh(this.orbGeometry, this.orbMaterial)
    group.add(ball)
    const halo = glowSprite(new THREE.Color(1.0, 0.6, 0.2), 2.6, 0.45)
    group.add(halo)
    return group
  }

  makeSpark(): { group: THREE.Group; arcs: THREE.Mesh; core: THREE.Mesh } {
    const group = new THREE.Group()
    const core = new THREE.Mesh(this.spikeGeometry, this.spikeMaterial)
    group.add(core)
    const arcs = billboard(
      3.4,
      SPARK_FRAGMENT,
      { uTime: { value: 0 }, uSeed: { value: Math.random() }, uFade: { value: 1 } },
      THREE.AdditiveBlending,
    )
    group.add(arcs)
    return { group, arcs, core }
  }

  dispose(): void {
    this.orbGeometry.dispose()
    this.orbMaterial.dispose()
    this.spikeGeometry.dispose()
    this.spikeMaterial.dispose()
  }
}
