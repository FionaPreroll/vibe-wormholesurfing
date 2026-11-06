import * as THREE from 'three'
import type { Item, Rarity } from '../../core/rewards'
import { roundedShape, smoothLathe, starGeometry, taperTube } from './shapes'

/** The light of each rarity, for glows, beams and the reward card. */
export const RARITY_COLORS: Readonly<Record<Rarity, number>> = {
  common: 0xcfd8e6,
  uncommon: 0x6fe08a,
  rare: 0x4fb0ff,
  epic: 0xc77dff,
  legendary: 0xffcf4a,
}

function gemMaterial(color: THREE.Color, shiny: boolean, glow: number) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.12,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    iridescence: shiny ? 1 : 0.25,
    iridescenceIOR: 1.7,
    sheen: shiny ? 1 : 0,
    sheenColor: new THREE.Color(1, 0.8, 1),
    emissive: color,
    emissiveIntensity: glow,
    flatShading: false,
  })
}

/** The geometry of each kind of treasure, centered and about one unit tall. */
function shapeGeometry(shape: Item['shape']): THREE.BufferGeometry {
  switch (shape) {
    case 'pebble': {
      const geometry = new THREE.IcosahedronGeometry(0.42, 3)
      const position = geometry.getAttribute('position') as THREE.BufferAttribute
      const v = new THREE.Vector3()
      for (let index = 0; index < position.count; index++) {
        v.fromBufferAttribute(position, index)
        const bump = 1 + Math.sin(v.x * 9) * 0.04 + Math.cos(v.y * 7 + v.z * 5) * 0.05
        v.multiply(new THREE.Vector3(1.15, 0.75, 1)).multiplyScalar(bump)
        position.setXYZ(index, v.x, v.y, v.z)
      }
      geometry.computeVertexNormals()
      return geometry
    }
    case 'feather': {
      const vane = new THREE.ExtrudeGeometry(
        roundedShape(
          [
            [0, -0.5],
            [0.2, -0.2],
            [0.18, 0.25],
            [0, 0.55],
            [-0.16, 0.2],
            [-0.18, -0.25],
          ],
          0.15,
        ),
        {
          depth: 0.02,
          bevelEnabled: true,
          bevelSize: 0.02,
          bevelThickness: 0.02,
          bevelSegments: 2,
        },
      )
      vane.translate(0, 0, -0.01)
      vane.rotateZ(-0.35)
      return vane
    }
    case 'crystal': {
      const parts = [
        [0, 0, 0, 0.22, 0.95, 0],
        [0.18, -0.1, 0.05, 0.13, 0.6, 0.4],
        [-0.16, -0.12, -0.04, 0.12, 0.55, -0.45],
        [0.04, -0.14, -0.17, 0.1, 0.45, 0.3],
      ] as const
      const geometries = parts.map(([x, y, z, r, h, tilt]) => {
        const g = new THREE.OctahedronGeometry(1, 0)
        g.scale(r, h * 0.62, r)
        g.rotateZ(tilt)
        g.translate(x, y, z)
        return g
      })
      return mergeAll(geometries)
    }
    case 'egg':
      return smoothLathe(
        [
          [0, -0.45],
          [0.26, -0.36],
          [0.34, -0.1],
          [0.3, 0.18],
          [0.18, 0.4],
          [0, 0.48],
        ],
        40,
        40,
      )
    case 'crown': {
      const band = new THREE.CylinderGeometry(0.36, 0.33, 0.2, 40, 1, true)
      const rim = new THREE.TorusGeometry(0.345, 0.035, 10, 40)
      rim.rotateX(Math.PI / 2)
      rim.translate(0, -0.1, 0)
      const spikes: THREE.BufferGeometry[] = []
      for (let index = 0; index < 7; index++) {
        const angle = (index / 7) * Math.PI * 2
        const spike = new THREE.ConeGeometry(0.07, 0.3, 8)
        spike.translate(0, 0.25, 0)
        spike.translate(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35)
        const ball = new THREE.SphereGeometry(0.05, 12, 8)
        ball.translate(Math.cos(angle) * 0.35, 0.42, Math.sin(angle) * 0.35)
        spikes.push(spike, ball)
      }
      return mergeAll([band, rim, ...spikes])
    }
    case 'shell': {
      const points: THREE.Vector3[] = []
      const radii: number[] = []
      for (let index = 0; index <= 24; index++) {
        const t = index / 24
        const angle = t * Math.PI * 3.2
        const r = 0.05 + t * 0.32
        points.push(new THREE.Vector3(Math.cos(angle) * r, 0.35 - t * 0.6, Math.sin(angle) * r))
        radii.push(0.03 + t * 0.2)
      }
      return taperTube(points, radii, 60, 14)
    }
    case 'orb':
      return new THREE.SphereGeometry(0.4, 40, 24)
    case 'flower': {
      const petals: THREE.BufferGeometry[] = []
      for (let ring = 0; ring < 2; ring++) {
        for (let index = 0; index < 6; index++) {
          const petal = new THREE.SphereGeometry(0.16, 16, 10)
          petal.scale(1, 0.3, 2 - ring * 0.5)
          petal.translate(0, ring * 0.06, 0.24 - ring * 0.06)
          petal.rotateX(-0.35 - ring * 0.35)
          petal.rotateY((index / 6) * Math.PI * 2 + ring * 0.5)
          petals.push(petal)
        }
      }
      const center = new THREE.SphereGeometry(0.11, 16, 12)
      center.translate(0, 0.08, 0)
      return mergeAll([...petals, center])
    }
    case 'star':
      return starGeometry(0.5, 0.22, 0.14)
    case 'gem': {
      const geometry = new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, -0.45),
          new THREE.Vector2(0.4, 0.05),
          new THREE.Vector2(0.3, 0.22),
          new THREE.Vector2(0, 0.25),
        ],
        8,
      )
      return geometry.toNonIndexed()
    }
    case 'leaf': {
      const geometry = new THREE.ExtrudeGeometry(
        roundedShape(
          [
            [0, -0.5],
            [0.32, -0.05],
            [0, 0.5],
            [-0.32, -0.05],
          ],
          0.22,
        ),
        {
          depth: 0.03,
          bevelEnabled: true,
          bevelSize: 0.02,
          bevelThickness: 0.02,
          bevelSegments: 2,
        },
      )
      geometry.translate(0, 0, -0.015)
      return geometry
    }
    case 'mushroom': {
      const cap = smoothLathe(
        [
          [0, 0.42],
          [0.28, 0.36],
          [0.4, 0.18],
          [0.36, 0.1],
          [0, 0.14],
        ],
        32,
        24,
      )
      const stem = smoothLathe(
        [
          [0, -0.42],
          [0.16, -0.4],
          [0.12, -0.1],
          [0.1, 0.16],
          [0, 0.16],
        ],
        24,
        16,
      )
      return mergeAll([cap, stem])
    }
  }
}

function mergeAll(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = geometries.map((geometry) => {
    const plain = geometry.index ? geometry.toNonIndexed() : geometry
    for (const name of Object.keys(plain.attributes))
      if (name !== 'position' && name !== 'normal') plain.deleteAttribute(name)
    return plain
  })
  const total = prepared.reduce(
    (sum, g) => sum + (g.getAttribute('position') as THREE.BufferAttribute).count,
    0,
  )
  const positions = new Float32Array(total * 3)
  const normals = new Float32Array(total * 3)
  let offset = 0
  for (const geometry of prepared) {
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    const normal = geometry.getAttribute('normal') as THREE.BufferAttribute
    positions.set(position.array as Float32Array, offset * 3)
    normals.set(normal.array as Float32Array, offset * 3)
    offset += position.count
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return merged
}

const GLOW: Readonly<Record<Rarity, number>> = {
  common: 0.08,
  uncommon: 0.15,
  rare: 0.25,
  epic: 0.35,
  legendary: 0.5,
}

/**
 * A treasure's model, about one unit tall: the shape of its kind in its color, glowing more the
 * rarer it is. A shiny one shimmers in every color.
 */
export function buildItem(item: Item, shiny: boolean): THREE.Mesh {
  const color = new THREE.Color(item.color)
  if (shiny) color.offsetHSL(0.12, 0.1, 0.05)
  const mesh = new THREE.Mesh(
    shapeGeometry(item.shape),
    gemMaterial(color, shiny, GLOW[item.rarity] + (shiny ? 0.25 : 0)),
  )
  mesh.castShadow = true
  return mesh
}

export function disposeItem(mesh: THREE.Mesh): void {
  mesh.geometry.dispose()
  ;(mesh.material as THREE.Material).dispose()
}
