import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { PropKind } from '../../core/layouts'
import { starGeometry } from '../models/shapes'

/** Paints a geometry in one color and keeps only what the merge needs. */
function paint(
  geometry: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
  glow = 0,
): THREE.BufferGeometry {
  const plain = geometry.index ? geometry.toNonIndexed() : geometry
  for (const name of Object.keys(plain.attributes))
    if (name !== 'position' && name !== 'normal') plain.deleteAttribute(name)
  if (!plain.getAttribute('normal')) plain.computeVertexNormals()
  const count = (plain.getAttribute('position') as THREE.BufferAttribute).count
  const c = new THREE.Color(color)
  const colors = new Float32Array(count * 3)
  for (let index = 0; index < count; index++) colors.set([c.r, c.g, c.b], index * 3)
  plain.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  plain.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(count).fill(glow), 1))
  return plain
}

/** Moves every vertex a little, by a smooth pattern, so rocks are lumpy rather than perfect. */
function lumpy(geometry: THREE.BufferGeometry, amount: number, seed = 1): THREE.BufferGeometry {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let index = 0; index < position.count; index++) {
    v.fromBufferAttribute(position, index)
    const bump =
      Math.sin(v.x * 3.1 + seed) * Math.cos(v.z * 2.7 - seed) * 0.6 +
      Math.sin(v.y * 4.3 + v.x * 1.7 + seed * 2) * 0.4
    v.multiplyScalar(1 + bump * amount)
    position.setXYZ(index, v.x, v.y, v.z)
  }
  geometry.computeVertexNormals()
  return geometry
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts, false)
  if (!geometry) throw new Error('Prop parts could not be merged')
  geometry.computeBoundingSphere()
  return geometry
}

/** Colors for a prop's body and its second part: leaves, a cap or a glow. */
export interface PropColors {
  readonly body: THREE.Color
  readonly accent: THREE.Color
}

/** The model of each kind of prop, with its origin on the ground. */
export function propGeometry(kind: PropKind, colors: PropColors): THREE.BufferGeometry {
  const { body, accent } = colors
  switch (kind) {
    case 'rock':
      return merged([
        paint(
          lumpy(new THREE.DodecahedronGeometry(0.55, 1), 0.18, 2)
            .translate(0, 0.22, 0)
            .scale(1.2, 0.8, 1),
          body,
        ),
      ])
    case 'boulder':
      return merged([
        paint(
          lumpy(new THREE.IcosahedronGeometry(1.3, 2), 0.15, 5)
            .scale(1.1, 0.75, 1)
            .translate(0, 0.7, 0),
          body,
        ),
      ])
    case 'mesa': {
      const parts: THREE.BufferGeometry[] = []
      const layers = 5
      for (let index = 0; index < layers; index++) {
        const radius = 2.6 - index * 0.18
        const layer = lumpy(
          new THREE.CylinderGeometry(radius * 0.94, radius, 1.8, 14, 2),
          0.06,
          index,
        )
        layer.translate(0, 0.9 + index * 1.75, 0)
        const shade = body.clone().offsetHSL(0, 0, index % 2 === 0 ? 0.04 : -0.03)
        parts.push(paint(layer, shade))
      }
      return merged(parts)
    }
    case 'tree': {
      const trunk = paint(new THREE.CylinderGeometry(0.12, 0.2, 2, 8).translate(0, 1, 0), body)
      const crowns = [
        [0, 2.4, 0, 1.1],
        [0.5, 2.1, 0.2, 0.75],
        [-0.45, 2.2, -0.25, 0.8],
        [0.1, 3.0, -0.1, 0.75],
      ].map(([x, y, z, r]) =>
        paint(
          lumpy(new THREE.IcosahedronGeometry(r, 1), 0.12, x).translate(
            x as number,
            y as number,
            z as number,
          ),
          accent.clone().offsetHSL(0, 0, (x as number) * 0.05),
        ),
      )
      return merged([trunk, ...crowns])
    }
    case 'palm': {
      const parts: THREE.BufferGeometry[] = []
      for (let index = 0; index < 6; index++) {
        const segment = new THREE.CylinderGeometry(
          0.14 - index * 0.008,
          0.17 - index * 0.008,
          0.6,
          8,
        )
        segment.translate(index * index * 0.018, 0.3 + index * 0.56, 0)
        parts.push(paint(segment, body.clone().offsetHSL(0, 0, index % 2 ? 0.05 : 0)))
      }
      const top = new THREE.Vector3(0.65, 3.4, 0)
      for (let index = 0; index < 7; index++) {
        const leaf = new THREE.ConeGeometry(0.35, 2.4, 4, 1, true)
        leaf.scale(1, 1, 0.18)
        leaf.translate(0, 1.2, 0)
        leaf.rotateZ(-1.15 - (index % 2) * 0.25)
        leaf.rotateY((index / 7) * Math.PI * 2)
        leaf.translate(top.x, top.y, top.z)
        parts.push(paint(leaf, accent.clone().offsetHSL(0, 0, index % 2 ? -0.05 : 0.03)))
      }
      parts.push(paint(new THREE.SphereGeometry(0.22, 8, 6).translate(top.x, top.y - 0.1, 0), body))
      return merged(parts)
    }
    case 'deadTree': {
      const trunk = new THREE.CylinderGeometry(0.1, 0.22, 2.6, 7).translate(0, 1.3, 0)
      const branches = [
        [0.6, 2.0, 0.9, 0.7],
        [-0.55, 2.3, -0.8, 0.6],
        [0.2, 2.6, 0.3, 0.5],
      ].map(([x, y, tilt, length]) => {
        const branch = new THREE.CylinderGeometry(0.04, 0.08, length as number, 6)
        branch.translate(0, (length as number) / 2, 0)
        branch.rotateZ(-(tilt as number))
        branch.translate(0, y as number, 0)
        branch.rotateY(x as number)
        return paint(branch, body)
      })
      return merged([paint(trunk, body), ...branches])
    }
    case 'blossomTree': {
      const trunk = paint(new THREE.CylinderGeometry(0.14, 0.24, 2.2, 8).translate(0, 1.1, 0), body)
      const blossoms = [
        [0, 2.7, 0, 1.3],
        [0.85, 2.4, 0.3, 0.9],
        [-0.8, 2.5, -0.35, 0.95],
        [0.2, 3.4, -0.2, 0.85],
        [-0.3, 2.3, 0.75, 0.75],
      ].map(([x, y, z, r], index) =>
        paint(
          lumpy(new THREE.IcosahedronGeometry(r as number, 1), 0.1, index).translate(
            x as number,
            y as number,
            z as number,
          ),
          accent.clone().offsetHSL(0, 0, index * 0.025 - 0.04),
        ),
      )
      return merged([trunk, ...blossoms])
    }
    case 'bush':
      return merged(
        [
          [0, 0.35, 0, 0.5],
          [0.4, 0.28, 0.1, 0.38],
          [-0.35, 0.3, -0.12, 0.4],
        ].map(([x, y, z, r], index) =>
          paint(
            lumpy(new THREE.IcosahedronGeometry(r as number, 1), 0.1, index).translate(
              x as number,
              y as number,
              z as number,
            ),
            body.clone().offsetHSL(0, 0, index * 0.03),
          ),
        ),
      )
    case 'grass':
    case 'shrub': {
      const blades: THREE.BufferGeometry[] = []
      const count = kind === 'grass' ? 7 : 9
      for (let index = 0; index < count; index++) {
        const blade = new THREE.BufferGeometry()
        const angle = (index / count) * Math.PI * 2 + index
        const lean = 0.12 + (index % 3) * 0.06
        const height = (kind === 'grass' ? 0.45 : 0.6) * (0.7 + (index % 4) * 0.12)
        const x = Math.cos(angle) * 0.08
        const z = Math.sin(angle) * 0.08
        const vertices = new Float32Array([
          x - 0.035,
          0,
          z,
          x + 0.035,
          0,
          z,
          x + Math.cos(angle) * lean,
          height,
          z + Math.sin(angle) * lean,
        ])
        blade.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
        blade.computeVertexNormals()
        const normal = blade.getAttribute('normal') as THREE.BufferAttribute
        // Point the normals up, so grass is lit like the ground under it.
        for (let v = 0; v < 3; v++) normal.setXYZ(v, 0, 1, 0)
        blades.push(paint(blade, body.clone().offsetHSL(0, 0, (index % 3) * 0.04 - 0.04)))
      }
      return merged(blades)
    }
    case 'flower': {
      const stem = paint(
        new THREE.CylinderGeometry(0.015, 0.02, 0.4, 5).translate(0, 0.2, 0),
        new THREE.Color(0x4f9f44),
      )
      const petals: THREE.BufferGeometry[] = []
      for (let index = 0; index < 5; index++) {
        const petal = new THREE.SphereGeometry(0.06, 6, 4)
        petal.scale(1, 0.35, 1.6)
        petal.translate(0, 0, 0.08)
        petal.rotateY((index / 5) * Math.PI * 2)
        petal.translate(0, 0.42, 0)
        petals.push(paint(petal, body))
      }
      const center = paint(
        new THREE.SphereGeometry(0.045, 6, 4).translate(0, 0.44, 0),
        new THREE.Color(0xffd84a),
      )
      return merged([stem, ...petals, center])
    }
    case 'coral': {
      const parts: THREE.BufferGeometry[] = []
      for (let index = 0; index < 6; index++) {
        const branch = new THREE.CapsuleGeometry(0.07, 0.5 + (index % 3) * 0.2, 3, 6)
        branch.translate(0, 0.35, 0)
        branch.rotateZ(((index % 3) - 1) * 0.5)
        branch.rotateY(index * 1.1)
        parts.push(paint(branch, body.clone().offsetHSL(index * 0.03, 0, 0)))
      }
      return merged(parts)
    }
    case 'crystal': {
      const parts = [
        [0, 0, 0.22, 1.2, 0],
        [0.25, 0.12, 0.14, 0.75, 0.45],
        [-0.22, -0.1, 0.15, 0.85, -0.4],
        [0.05, -0.28, 0.11, 0.6, 0.3],
      ].map(([x, z, r, h, tilt]) => {
        const shard = new THREE.CylinderGeometry(0, r as number, (h as number) * 0.3, 6)
        shard.translate(0, (h as number) * 0.85, 0)
        const column = new THREE.CylinderGeometry(
          r as number,
          (r as number) * 1.05,
          (h as number) * 0.7,
          6,
        )
        column.translate(0, (h as number) * 0.35, 0)
        const piece = merged([paint(shard, body, 1), paint(column, body, 0.7)])
        piece.rotateX(tilt as number)
        piece.rotateZ((tilt as number) * 0.6)
        piece.translate(x as number, 0, z as number)
        return piece
      })
      return merged(parts)
    }
    case 'crystalPillar': {
      const parts: THREE.BufferGeometry[] = []
      for (let index = 0; index < 5; index++) {
        const height = 4 + (index % 3) * 1.8
        const radius = 0.5 - index * 0.05
        const column = new THREE.CylinderGeometry(radius, radius * 1.1, height, 6)
        column.translate(0, height / 2, 0)
        const tip = new THREE.CylinderGeometry(0, radius, radius * 2, 6)
        tip.translate(0, height + radius, 0)
        const piece = merged([paint(column, body, 0.5), paint(tip, body, 1)])
        piece.rotateZ((index - 2) * 0.16)
        piece.rotateY(index * 1.3)
        piece.translate(Math.cos(index * 2.1) * 0.55, 0, Math.sin(index * 2.1) * 0.55)
        parts.push(piece)
      }
      return merged(parts)
    }
    case 'spire': {
      const parts: THREE.BufferGeometry[] = []
      for (let index = 0; index < 4; index++) {
        const radius = 1.4 - index * 0.32
        const piece = lumpy(
          new THREE.CylinderGeometry(radius * 0.7, radius, 2.6, 9, 2),
          0.08,
          index,
        )
        piece.translate(Math.sin(index) * 0.3, 1.3 + index * 2.4, Math.cos(index) * 0.2)
        parts.push(paint(piece, body.clone().offsetHSL(0, 0, index * 0.02)))
      }
      return merged(parts)
    }
    case 'mushroom': {
      const stem = paint(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 10).translate(0, 0.45, 0), body)
      const cap = new THREE.SphereGeometry(0.45, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)
      cap.scale(1, 0.6, 1)
      cap.translate(0, 0.85, 0)
      const spots: THREE.BufferGeometry[] = []
      for (let index = 0; index < 5; index++) {
        const spot = new THREE.SphereGeometry(0.06, 6, 4)
        const angle = index * 1.3
        spot.translate(Math.cos(angle) * 0.28, 1.0, Math.sin(angle) * 0.28)
        spots.push(paint(spot, new THREE.Color(0xffffff)))
      }
      return merged([stem, paint(cap, accent, 1), ...spots])
    }
    case 'stalagmite':
      return merged([
        paint(lumpy(new THREE.ConeGeometry(0.7, 3.2, 9, 3), 0.1, 3).translate(0, 1.6, 0), body),
      ])
    case 'monolith': {
      const block = new THREE.BoxGeometry(1.4, 5, 0.6, 1, 4, 1)
      block.translate(0, 2.5, 0)
      const runes: THREE.BufferGeometry[] = []
      for (let index = 0; index < 4; index++) {
        const rune = starGeometry(0.16, 0.07, 0.04)
        rune.translate(0, 1.2 + index * 1.0, 0.32)
        runes.push(paint(rune, accent, 1))
      }
      return merged([paint(block, body), ...runes])
    }
    case 'lantern': {
      const post = paint(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6).translate(0, 0.8, 0), body)
      const arm = paint(
        new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5).rotateZ(Math.PI / 2).translate(0.2, 1.55, 0),
        body,
      )
      const lamp = paint(
        new THREE.SphereGeometry(0.2, 14, 10).scale(1, 1.25, 1).translate(0.42, 1.3, 0),
        accent,
        1,
      )
      return merged([post, arm, lamp])
    }
  }
}

/** Kinds whose second color glows: crystals, mushroom caps, lanterns and runes. */
export const GLOWING: ReadonlySet<PropKind> = new Set([
  'crystal',
  'crystalPillar',
  'mushroom',
  'lantern',
  'monolith',
])

/** Kinds that bend in the wind. */
export const SWAYING: ReadonlySet<PropKind> = new Set([
  'grass',
  'shrub',
  'flower',
  'palm',
  'tree',
  'blossomTree',
  'bush',
  'coral',
])

/** Kinds too small to cast a shadow worth its cost. */
export const NO_SHADOW: ReadonlySet<PropKind> = new Set([
  'grass',
  'shrub',
  'flower',
  'coral',
  'rock',
])
