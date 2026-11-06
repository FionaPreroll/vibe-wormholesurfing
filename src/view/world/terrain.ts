import * as THREE from 'three'
import type { Land } from '../../core/land'
import { simplex2 } from '../../core/noise'
import type { WorldTheme } from './themes'

export const TERRAIN_SIZE = 270

/** The ground as a mesh, colored by height and steepness, plus its heights as a texture. */
export interface Terrain {
  readonly mesh: THREE.Mesh
  /** Heights over the ground's square, for water to know how deep it is. */
  readonly heights: THREE.DataTexture
}

export function buildTerrain(land: Land, theme: WorldTheme, detail: number, seed: number): Terrain {
  const segments = Math.round(150 + 90 * Math.min(1.3, detail))
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(position.count * 3)
  const ground = theme.ground
  const low = new THREE.Color(ground.low)
  const mid = new THREE.Color(ground.mid)
  const high = new THREE.Color(ground.high)
  const steep = new THREE.Color(ground.steep)
  const shore = ground.shore === undefined ? undefined : new THREE.Color(ground.shore)
  const color = new THREE.Color()
  const speckle = simplex2(seed ^ 0x77)
  const water = land.shape.water
  // Height span for the color ramp: the landing site to the top of the rim.
  const bottom = land.shape.landing - 4
  const top = land.shape.landing + Math.max(8, land.shape.ridges + land.shape.hills + 4)
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const z = position.getZ(index)
    const y = land.heightAt(x, z)
    position.setY(index, y)
    const t = THREE.MathUtils.clamp((y - bottom) / (top - bottom), 0, 1)
    color.copy(low).lerp(mid, THREE.MathUtils.smoothstep(t, 0.15, 0.5))
    color.lerp(high, THREE.MathUtils.smoothstep(t, 0.55, 0.95))
    const slope = land.slopeAt(x, z)
    color.lerp(steep, THREE.MathUtils.smoothstep(slope, 0.7, 1.6))
    if (shore && water !== undefined)
      color.lerp(shore, 1 - THREE.MathUtils.smoothstep(y, water + 0.3, water + 1.4))
    // Patches and specks keep large areas from looking flat.
    const n = speckle(x * 0.08, z * 0.08) * 0.5 + speckle(x * 0.5, z * 0.5) * 0.25
    color.offsetHSL(n * 0.015, n * 0.05, n * 0.06)
    colors.set([color.r, color.g, color.b], index * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
  )
  mesh.receiveShadow = true

  // Half floats, since phones may not filter full floats smoothly.
  const size = 256
  const data = new Uint16Array(size * size)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i / (size - 1) - 0.5) * TERRAIN_SIZE
      const z = (j / (size - 1) - 0.5) * TERRAIN_SIZE
      data[j * size + i] = THREE.DataUtils.toHalfFloat(land.heightAt(x, z))
    }
  }
  const heights = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.HalfFloatType)
  heights.magFilter = THREE.LinearFilter
  heights.minFilter = THREE.LinearFilter
  heights.needsUpdate = true
  return { mesh, heights }
}
