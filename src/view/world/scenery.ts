import * as THREE from 'three'
import type { Land } from '../../core/land'
import type { PropKind } from '../../core/layouts'
import { seededRandom } from '../../core/random'
import type { Prop } from '../../core/scatter'
import { GLOWING, NO_SHADOW, propGeometry, SWAYING } from './propModels'
import type { WorldTheme } from './themes'

const SWAY: Partial<Record<PropKind, number>> = {
  grass: 0.28,
  shrub: 0.22,
  flower: 0.2,
  coral: 0.12,
  bush: 0.03,
  palm: 0.025,
  tree: 0.02,
  blossomTree: 0.02,
}

/**
 * A lit material for props, with two additions: plants bend in the wind, rooted at the ground,
 * and parts painted to glow give off their own light.
 */
function sceneryMaterial(
  kind: PropKind,
  time: { value: number },
  glow: number,
): THREE.MeshStandardMaterial {
  const crystal = kind === 'crystal' || kind === 'crystalPillar'
  const thin = kind === 'grass' || kind === 'shrub' || kind === 'palm'
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: crystal ? 0.18 : kind === 'monolith' ? 0.4 : 0.85,
    metalness: crystal ? 0.15 : 0,
    flatShading: crystal || kind === 'rock' || kind === 'boulder' || kind === 'spire',
    side: thin ? THREE.DoubleSide : THREE.FrontSide,
  })
  const sway = SWAYING.has(kind) ? (SWAY[kind] ?? 0) : 0
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    shader.uniforms.uGlow = { value: glow }
    shader.vertexShader =
      `attribute float glow;\nvarying float vGlow;\nuniform float uTime;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      vGlow = glow;
      #ifdef USE_INSTANCING
      vec3 root = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
      vec3 root = vec3(0.0);
      #endif
      float bend = max(transformed.y, 0.0) * ${sway.toFixed(3)};
      float gust = 0.6 + 0.4 * sin(uTime * 0.6 + root.x * 0.05);
      transformed.x += sin(uTime * 1.9 + root.x * 0.35 + root.z * 0.21) * bend * gust;
      transformed.z += cos(uTime * 1.4 + root.x * 0.17 + root.z * 0.3) * bend * 0.6 * gust;`,
      )
    shader.fragmentShader =
      `varying float vGlow;\nuniform float uGlow;\n${shader.fragmentShader}`.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
      totalEmissiveRadiance += vColor.rgb * vGlow * uGlow;`,
      )
  }
  material.customProgramCacheKey = () => `scenery-${sway}`
  return material
}

const FLOWER_TINTS = [0xffffff, 0xffe066, 0xc8b8ff, 0xffa8c8, 0x9fd8ff]

/** Every prop of a world as instanced meshes, one per kind. */
export function buildProps(
  props: readonly Prop[],
  theme: WorldTheme,
  time: { value: number },
  detail: number,
  shadows: boolean,
  seed: number,
): THREE.Group {
  const group = new THREE.Group()
  const random = seededRandom(seed ^ 0xa11)
  const byKind = new Map<PropKind, Prop[]>()
  for (const prop of props) {
    // Small plants thin out on modest hardware; nothing that blocks the way is left out.
    if (prop.block === 0 && detail < 1 && random() > detail) continue
    const list = byKind.get(prop.kind) ?? []
    list.push(prop)
    byKind.set(prop.kind, list)
  }
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const tint = new THREE.Color()
  for (const [kind, list] of byKind) {
    const [body = 0x888888, accent] = theme.props[kind] ?? []
    const colors = { body: new THREE.Color(body), accent: new THREE.Color(accent ?? body) }
    const geometry = propGeometry(
      kind === 'flower' ? kind : kind,
      kind === 'flower' ? { body: new THREE.Color(0xffffff), accent: colors.accent } : colors,
    )
    const glow = GLOWING.has(kind) ? (kind === 'crystalPillar' ? 0.9 : 1.6) * (theme.glow ?? 1) : 0
    const mesh = new THREE.InstancedMesh(geometry, sceneryMaterial(kind, time, glow), list.length)
    for (const [index, prop] of list.entries()) {
      const tilt = kind === 'rock' || kind === 'boulder' || kind === 'crystal' ? 0.25 : 0.06
      euler.set((random() - 0.5) * tilt, prop.yaw, (random() - 0.5) * tilt)
      quaternion.setFromEuler(euler)
      const sink = kind === 'rock' || kind === 'boulder' ? 0.15 * prop.scale : 0.05
      position.set(prop.x, prop.y - sink, prop.z)
      scale.setScalar(prop.scale)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(index, matrix)
      if (kind === 'flower')
        tint.set(index % 3 === 0 ? body : (FLOWER_TINTS[index % FLOWER_TINTS.length] as number))
      else tint.setRGB(1, 1, 1).offsetHSL((random() - 0.5) * 0.03, 0, (random() - 0.5) * 0.12)
      mesh.setColorAt(index, tint)
    }
    mesh.castShadow = shadows && !NO_SHADOW.has(kind)
    mesh.receiveShadow = shadows && kind !== 'grass' && kind !== 'flower'
    mesh.computeBoundingSphere()
    group.add(mesh)
  }
  return group
}

/** Glowing specks that float in the air: pollen, embers, spores or sparkles. */
export function buildMotes(
  theme: WorldTheme,
  land: Land,
  time: { value: number },
  detail: number,
  seed: number,
): THREE.Points {
  const random = seededRandom(seed ^ 0x3e3)
  const count = Math.round(theme.motes.count * Math.max(0.5, detail))
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    const angle = random() * Math.PI * 2
    const distance = Math.sqrt(random()) * 75
    const x = Math.cos(angle) * distance
    const z = Math.sin(angle) * distance
    positions.set([x, land.heightAt(x, z) + 0.5 + random() * 7, z], index * 3)
    seeds[index] = random()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: time,
      uColor: { value: new THREE.Color(theme.motes.color) },
      uSize: { value: theme.motes.size },
      uRise: { value: theme.motes.rise },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSize;
      uniform float uRise;
      attribute float aSeed;
      varying float vTwinkle;
      void main() {
        vec3 p = position;
        float t = uTime * (0.3 + aSeed * 0.4) + aSeed * 30.0;
        p.x += sin(t) * 1.2;
        p.z += cos(t * 0.8) * 1.2;
        p.y += mod(uTime * uRise + aSeed * 8.0, 8.0) - 4.0;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = min(24.0, uSize * 700.0 / max(1.0, -view.z));
        vTwinkle = 0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 20.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(uColor * glow * glow * (0.6 + vTwinkle) * 1.4, glow);
      }
    `,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  return points
}

/** Small islands that float around the edge of a floating world, bobbing slowly. */
export function buildIslands(theme: WorldTheme, seed: number): THREE.Group {
  const random = seededRandom(seed ^ 0x15)
  const group = new THREE.Group()
  const rock = new THREE.MeshStandardMaterial({
    color: theme.ground.steep,
    roughness: 0.9,
    flatShading: true,
  })
  const top = new THREE.MeshStandardMaterial({ color: theme.ground.mid, roughness: 0.9 })
  for (let index = 0; index < 9; index++) {
    const angle = (index / 9) * Math.PI * 2 + random() * 0.4
    const distance = 95 + random() * 70
    const size = 3 + random() * 7
    const island = new THREE.Group()
    const base = new THREE.Mesh(new THREE.ConeGeometry(size, size * 1.8, 8, 2), rock)
    base.rotation.x = Math.PI
    base.position.y = -size * 0.9
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(size * 1.02, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      top,
    )
    cap.scale.y = 0.25
    island.add(base, cap)
    island.position.set(Math.cos(angle) * distance, -10 + random() * 40, Math.sin(angle) * distance)
    island.userData.bob = random() * 10
    group.add(island)
  }
  return group
}

/** The ceiling of a cave: a lumpy dome with stalactites hanging from it. */
export function buildCeiling(height: number, theme: WorldTheme, seed: number): THREE.Group {
  const random = seededRandom(seed ^ 0xce)
  const group = new THREE.Group()
  const dome = new THREE.SphereGeometry(110, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2)
  const position = dome.getAttribute('position') as THREE.BufferAttribute
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const bump = Math.sin(x * 0.15) * Math.cos(z * 0.13) * 3 + Math.sin(x * 0.4 + z * 0.3) * 1.2
    position.setY(index, (y * (height + 6)) / 110 + bump)
  }
  dome.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({
    color: theme.ground.steep,
    roughness: 0.95,
    side: THREE.BackSide,
    flatShading: true,
  })
  group.add(new THREE.Mesh(dome, material))
  const cone = new THREE.ConeGeometry(0.8, 5, 7, 2)
  cone.rotateX(Math.PI)
  const hanging = new THREE.InstancedMesh(
    cone,
    new THREE.MeshStandardMaterial({ color: theme.ground.high, roughness: 0.9, flatShading: true }),
    90,
  )
  const matrix = new THREE.Matrix4()
  for (let index = 0; index < 90; index++) {
    const angle = random() * Math.PI * 2
    const distance = Math.sqrt(random()) * 90
    const x = Math.cos(angle) * distance
    const z = Math.sin(angle) * distance
    const roof = (height + 6) * Math.sqrt(Math.max(0, 1 - (distance / 110) ** 2))
    const s = 0.6 + random() * 1.4
    matrix.compose(
      new THREE.Vector3(x, roof - 2 * s, z),
      new THREE.Quaternion(),
      new THREE.Vector3(s, s * (0.7 + random()), s),
    )
    hanging.setMatrixAt(index, matrix)
  }
  group.add(hanging)
  return group
}
