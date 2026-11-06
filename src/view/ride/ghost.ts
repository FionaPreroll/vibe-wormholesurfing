import * as THREE from 'three'
import { ghostOpacity, ghostOutline } from '../models/toon'

/**
 * Where the model draws among the see-through things of the scene. Whole, it draws first, as an
 * opaque model would: everything after it, its flames, light trails and the rest, is hidden only
 * where it lies behind. See-through, it draws after the rest, so what lies behind it shows: first
 * its depth, then its colors and its glass.
 */
const ORDERS = {
  whole: { color: -30, glass: -29 },
  ghost: { depth: 10, color: 11, glass: 12 },
} as const

/** Light that belongs to the model or follows it, as engine flames and light trails: after it. */
export const LIGHT_ORDER = 13

/** Below this, the model counts as whole. */
const WHOLE = 0.999

/**
 * Makes a model see-through as one piece, as the ship and its pilot in a ride, so the way ahead
 * shows through them. A depth pass draws the model's front first, without color; then only that
 * front blends over what lies behind, so the far wing or the pilot's back do not shine through
 * the hull. The depth pass is pushed back a hair (polygon offset): it runs another shader than
 * the colors, and some drivers, as Metal's on Macs, work out a depth a little apart from that,
 * which made the hull flicker. Every material turns transparent once, when the stage is made, so
 * changing how much shows never compiles a shader during the ride; a whole model draws without
 * the depth pass and before the rest, as an opaque one does.
 */
export class Ghost {
  readonly #depth = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  })
  /** Each blended material with the opacity it had of its own, as the canopy's glass. */
  readonly #materials = new Map<THREE.Material, number>()
  readonly #colors: THREE.Mesh[] = []
  readonly #glass: THREE.Mesh[] = []
  readonly #depths: THREE.Mesh[] = []
  #whole: boolean | undefined

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
        mesh.renderOrder = ORDERS.ghost.color
        this.#colors.push(mesh)
        continue
      }
      // Light, as the engine's flames, adds up and stays as bright; it lies over the hull.
      if (material.blending !== THREE.NormalBlending) {
        mesh.renderOrder = LIGHT_ORDER
        continue
      }
      if (material.transparent) {
        // Glass and blush lie over the rest and stay as clear as they were, relative to it.
        mesh.renderOrder = ORDERS.ghost.glass
        this.#glass.push(mesh)
        this.#materials.set(material, material.opacity)
        continue
      }
      material.transparent = true
      this.#materials.set(material, 1)
      mesh.renderOrder = ORDERS.ghost.color
      this.#colors.push(mesh)
      const depth = new THREE.Mesh(mesh.geometry, this.#depth)
      depth.name = 'ghost-depth'
      depth.renderOrder = ORDERS.ghost.depth
      depth.castShadow = false
      depth.receiveShadow = false
      mesh.add(depth)
      this.#depths.push(depth)
    }
    // Set up see-through until the stage first says how much shows, so that the depth pass is
    // there to compile with the stage, whole or not.
  }

  /** How much of the model shows, 0 to 1. */
  set opacity(value: number) {
    for (const [material, own] of this.#materials) material.opacity = own * value
    ghostOpacity.value = value
    const whole = value >= WHOLE
    if (whole === this.#whole) return
    this.#whole = whole
    const orders = whole ? ORDERS.whole : ORDERS.ghost
    for (const mesh of this.#colors) mesh.renderOrder = orders.color
    for (const mesh of this.#glass) mesh.renderOrder = orders.glass
    for (const mesh of this.#depths) mesh.visible = !whole
  }

  dispose(): void {
    this.#depth.dispose()
  }
}
