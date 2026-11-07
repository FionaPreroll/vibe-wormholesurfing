import * as THREE from 'three'

export type HitboxKind = 'ship' | 'middle' | 'orb' | 'spark' | 'hole' | 'field'

const COLORS: Readonly<Record<HitboxKind, number>> = {
  ship: 0x6ff0ff,
  // The point warp holes take the ship by, in the holes' color.
  middle: 0x9dff8a,
  orb: 0xffd36b,
  spark: 0xff5a7a,
  hole: 0x9dff8a,
  field: 0x8a7cff,
}

/** How large the mark of the ship's middle draws: holes test a point, not a circle. */
export const MIDDLE_MARK = 0.12

/**
 * The circles the ride's rules test, drawn over the ride for debugging (Settings → Show
 * hitboxes): the ship's for orbs and sparks, a small mark on the ship's middle, which warp holes
 * test, every orb's and spark's, the part of each warp hole that takes the ship, and the edge of
 * the field the ship's middle stays in. The rules test them across the
 * tunnel, so each is a circle facing along it, where the view draws its thing, bent with the
 * tunnel, and at its own size, not the drawn thing's.
 */
export class Hitboxes {
  readonly group = new THREE.Group()
  readonly #geometry: THREE.BufferGeometry
  readonly #materials = new Map<HitboxKind, THREE.LineBasicMaterial>()
  readonly #circles: THREE.LineLoop[] = []
  #used = 0

  constructor() {
    const points: number[] = []
    for (let index = 0; index < 64; index++) {
      const angle = (index / 64) * Math.PI * 2
      points.push(Math.cos(angle), Math.sin(angle), 0)
    }
    this.#geometry = new THREE.BufferGeometry()
    this.#geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    for (const [kind, color] of Object.entries(COLORS) as [HitboxKind, number][])
      this.#materials.set(
        kind,
        new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: kind === 'field' ? 0.45 : 0.95,
          // Over everything, so a hitbox shows even inside its thing.
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
      )
    this.group.name = 'hitboxes'
    this.group.renderOrder = 50
    this.group.visible = false
  }

  /** Starts a frame's circles. */
  begin(): void {
    this.#used = 0
  }

  /** One circle across the tunnel, its middle at a point of the view. */
  circle(kind: HitboxKind, x: number, y: number, z: number, radius: number): void {
    let circle = this.#circles[this.#used]
    if (!circle) {
      circle = new THREE.LineLoop(this.#geometry, this.#materials.get(kind))
      circle.renderOrder = 50
      circle.frustumCulled = false
      this.#circles.push(circle)
      this.group.add(circle)
    }
    this.#used++
    circle.material = this.#materials.get(kind) as THREE.LineBasicMaterial
    circle.position.set(x, y, z)
    circle.scale.setScalar(radius)
    circle.visible = true
  }

  /** Hides the circles this frame did not use. */
  end(): void {
    for (let index = this.#used; index < this.#circles.length; index++)
      (this.#circles[index] as THREE.LineLoop).visible = false
  }

  /** How many circles show, for tests. */
  get shown(): number {
    return this.group.visible ? this.#used : 0
  }

  dispose(): void {
    this.#geometry.dispose()
    for (const material of this.#materials.values()) material.dispose()
  }
}
