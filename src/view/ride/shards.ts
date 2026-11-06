import * as THREE from 'three'
import { bendAt } from './bend'

const LOOP = 460

interface Shard {
  angle: number
  radius: number
  z: number
  spin: THREE.Vector3
  scale: THREE.Vector3
  rotation: THREE.Euler
}

/** Chunks of glassy crystal that tumble past along the walls, as debris of torn space. */
export class Shards {
  readonly mesh: THREE.InstancedMesh
  readonly #shards: Shard[] = []
  readonly #matrix = new THREE.Matrix4()
  readonly #quaternion = new THREE.Quaternion()
  readonly #position = new THREE.Vector3()
  readonly #offset = new THREE.Vector2()

  constructor(count: number) {
    const geometry = new THREE.IcosahedronGeometry(1, 0)
    // Pull a few corners out so each chunk is a jagged crystal, not a ball.
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    for (let index = 0; index < position.count; index++) {
      const y = position.getY(index)
      position.setY(index, y * (1.6 + Math.abs(y) * 0.8))
    }
    geometry.computeVertexNormals()
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x3a3488,
      roughness: 0.06,
      metalness: 0.55,
      clearcoat: 1,
      iridescence: 1,
      iridescenceIOR: 1.8,
      emissive: 0x120a3a,
      flatShading: true,
    })
    this.mesh = new THREE.InstancedMesh(geometry, material, count)
    this.mesh.frustumCulled = false
    const color = new THREE.Color()
    for (let index = 0; index < count; index++) {
      const big = Math.random() < 0.15
      const size = big ? 1.2 + Math.random() * 1.6 : 0.15 + Math.random() * 0.6
      this.#shards.push({
        angle: Math.random() * Math.PI * 2,
        radius: 9.5 + Math.random() * 9,
        z: Math.random() * LOOP,
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(0.3 + Math.random() * 1.2),
        scale: new THREE.Vector3(size, size * (0.8 + Math.random() * 0.6), size),
        rotation: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      })
      color.setHSL(0.64 + Math.random() * 0.18, 0.5, 0.3 + Math.random() * 0.3)
      this.mesh.setColorAt(index, color)
    }
  }

  update(dt: number, travel: number, bend: THREE.Vector2): void {
    for (const [index, shard] of this.#shards.entries()) {
      shard.rotation.x += shard.spin.x * dt
      shard.rotation.y += shard.spin.y * dt
      shard.rotation.z += shard.spin.z * dt
      const depth = ((((shard.z - travel * 0.95) % LOOP) + LOOP) % LOOP) - 25
      bendAt(depth, bend, this.#offset)
      this.#position.set(
        Math.cos(shard.angle) * shard.radius + this.#offset.x,
        Math.sin(shard.angle) * shard.radius + this.#offset.y,
        -depth,
      )
      const fade = Math.min(1, Math.max(0, (380 - depth) / 80))
      this.#quaternion.setFromEuler(shard.rotation)
      this.#matrix.compose(
        this.#position,
        this.#quaternion,
        shard.scale.clone().multiplyScalar(Math.max(0.001, fade)),
      )
      this.mesh.setMatrixAt(index, this.#matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
