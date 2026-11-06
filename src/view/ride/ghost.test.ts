import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildShip } from '../models/ship'
import { Ghost, LIGHT_ORDER } from './ghost'

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = []
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) found.push(object)
  })
  return found
}

describe('Ghost', () => {
  const ship = buildShip()
  const ghost = new Ghost(ship.group)
  const all = meshes(ship.group)
  const depth = all.filter((mesh) => mesh.name === 'ghost-depth')
  const light = all.filter(
    (mesh) => (mesh.material as THREE.Material).blending !== THREE.NormalBlending,
  )
  const hull = all.filter(
    (mesh) =>
      mesh.name !== 'ghost-depth' &&
      (mesh.material as THREE.Material).blending === THREE.NormalBlending &&
      (mesh.material as THREE.Material).opacity === 1,
  )

  it('turns the ship transparent once, so that how much shows never compiles a shader', () => {
    expect(hull.length).toBeGreaterThan(3)
    for (const mesh of hull) expect((mesh.material as THREE.Material).transparent).toBe(true)
  })

  // Since the ship became see-through it drew over its own flames and light trails, which
  // flickered as it turned on the title screen.
  it('draws a whole ship first among the see-through things, without the depth pass', () => {
    ghost.opacity = 1
    for (const mesh of hull) expect(mesh.renderOrder).toBeLessThan(0)
    for (const mesh of depth) expect(mesh.visible).toBe(false)
    for (const mesh of light) expect(mesh.renderOrder).toBe(LIGHT_ORDER)
  })

  it('draws a see-through ship after the rest: depth first, then colors, then its light', () => {
    ghost.opacity = 0.62
    expect(depth.length).toBeGreaterThan(3)
    const depthOrder = Math.max(...depth.map((mesh) => mesh.renderOrder))
    for (const mesh of depth) expect(mesh.visible).toBe(true)
    for (const mesh of hull) {
      expect(mesh.renderOrder).toBeGreaterThan(depthOrder)
      expect(mesh.renderOrder).toBeLessThan(LIGHT_ORDER)
      expect((mesh.material as THREE.Material).opacity).toBeCloseTo(0.62)
    }
    // Pushed back a hair, as Metal works its depth out a little apart from the colors'.
    const material = depth[0]?.material as THREE.Material
    expect(material.polygonOffset).toBe(true)
    expect(material.polygonOffsetFactor).toBeGreaterThan(0)
    expect(material.colorWrite).toBe(false)
  })

  it('keeps glass as clear as it was, relative to the rest', () => {
    const glass = all.filter(
      (mesh) =>
        (mesh.material as THREE.Material).blending === THREE.NormalBlending &&
        mesh.name !== 'ghost-depth' &&
        !hull.includes(mesh),
    )
    ghost.opacity = 0.5
    for (const mesh of glass) expect((mesh.material as THREE.Material).opacity).toBeLessThan(0.5)
  })
})
