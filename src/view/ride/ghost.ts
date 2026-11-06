import * as THREE from 'three'
import { ghostOpacity, ghostOutline } from '../models/toon'

/** Drawn after everything else that is see-through: first the depth, then the colors. */
const DEPTH_ORDER = 10
const COLOR_ORDER = 11
const GLASS_ORDER = 12

/**
 * Makes a model see-through as one piece, as the ship and its pilot in a ride, so the way ahead
 * shows through them. A depth pass draws the model's front first, without color; then only that
 * front blends over what lies behind, so the far wing or the pilot's back do not shine through
 * the hull. Every material turns transparent once, when the stage is made, so changing how much
 * shows never compiles a shader during the ride.
 */
export class Ghost {
  readonly #depth = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    transparent: true,
  })
  /** Each blended material with the opacity it had of its own, as the canopy's glass. */
  readonly #materials = new Map<THREE.Material, number>()

  constructor(root: THREE.Object3D) {
    const meshes: THREE.Mesh[] = []
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object)
    })
    for (const mesh of meshes) {
      const material = mesh.material
      if (Array.isArray(material)) continue
      if (mesh.name === 'outline' && material instanceof THREE.ShaderMaterial) {
        mesh.material = ghostOutline(material)
        mesh.renderOrder = COLOR_ORDER
        continue
      }
      // Light, as the engine's flames, adds up and stays as bright.
      if (material.blending !== THREE.NormalBlending) continue
      if (material.transparent) {
        // Glass and blush lie over the rest and stay as clear as they were, relative to it.
        mesh.renderOrder = GLASS_ORDER
        this.#materials.set(material, material.opacity)
        continue
      }
      material.transparent = true
      this.#materials.set(material, 1)
      mesh.renderOrder = COLOR_ORDER
      const depth = new THREE.Mesh(mesh.geometry, this.#depth)
      depth.name = 'ghost-depth'
      depth.renderOrder = DEPTH_ORDER
      depth.castShadow = false
      depth.receiveShadow = false
      mesh.add(depth)
    }
  }

  /** How much of the model shows, 0 to 1. */
  set opacity(value: number) {
    for (const [material, own] of this.#materials) material.opacity = own * value
    ghostOpacity.value = value
  }

  dispose(): void {
    this.#depth.dispose()
  }
}
