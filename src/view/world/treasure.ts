import * as THREE from 'three'
import { OPEN_TIME } from '../../core/expedition'
import { clamp } from '../../core/math'
import type { Reward } from '../../core/rewards'
import { glowSprite } from '../glow'
import { buildItem, disposeItem, RARITY_COLORS } from '../models/items'
import { starGeometry } from '../models/shapes'
import { uniform } from '../uniforms'

const BEAM_COLOR = new THREE.Color(0.55, 0.9, 1.0)

function ease(t: number): number {
  const x = clamp(t, 0, 1)
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

/**
 * The treasure: a star capsule on a pedestal under a pillar of light that shows the way from
 * afar. Opened, its lid swings up and the treasure rises out of it in the light of its rarity.
 */
export class TreasureView {
  readonly group = new THREE.Group()
  readonly item: THREE.Mesh
  readonly #lid = new THREE.Group()
  readonly #seam: THREE.Mesh
  readonly #beam: THREE.Mesh
  readonly #inner: THREE.Sprite
  readonly #halo: THREE.Sprite
  readonly #shock: THREE.Mesh
  readonly #rarity: THREE.Color
  readonly #light: THREE.PointLight | undefined
  #revealedAt = -1

  constructor(
    readonly reward: Reward,
    lights: boolean,
  ) {
    this.#rarity = new THREE.Color(RARITY_COLORS[reward.item.rarity])
    const stone = new THREE.MeshStandardMaterial({
      color: 0x5c567a,
      roughness: 0.7,
      flatShading: true,
    })
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.2, 0.4, 10), stone)
    pedestal.position.y = 0.2
    pedestal.castShadow = true
    pedestal.receiveShadow = true
    this.group.add(pedestal)
    const runes = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.035, 8, 48),
      new THREE.MeshBasicMaterial({ color: BEAM_COLOR.clone().multiplyScalar(1.6) }),
    )
    runes.rotation.x = Math.PI / 2
    runes.position.y = 0.41
    this.group.add(runes)

    const shell = new THREE.MeshPhysicalMaterial({
      color: 0xfff8f0,
      roughness: 0.25,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    })
    const gold = new THREE.MeshPhysicalMaterial({
      color: 0xffcf6a,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x4a3000,
    })
    const bottom = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      shell,
    )
    bottom.position.y = 0.95
    bottom.castShadow = true
    this.group.add(bottom)
    // The lid hinges at the back of the capsule.
    this.#lid.position.set(0, 0.95, -0.62)
    this.group.add(this.#lid)
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      shell,
    )
    lid.position.z = 0.62
    lid.castShadow = true
    this.#lid.add(lid)
    const emblem = new THREE.Mesh(starGeometry(0.2, 0.09, 0.05), gold)
    emblem.position.set(0, 0.45, 0.62 + 0.3)
    emblem.rotation.x = -0.75
    this.#lid.add(emblem)
    this.#seam = new THREE.Mesh(
      new THREE.TorusGeometry(0.625, 0.04, 10, 48),
      new THREE.MeshBasicMaterial({ color: BEAM_COLOR.clone().multiplyScalar(2) }),
    )
    this.#seam.rotation.x = Math.PI / 2
    this.#seam.position.y = 0.95
    this.group.add(this.#seam)

    this.#inner = glowSprite(BEAM_COLOR, 1.6, 0.6)
    this.#inner.position.y = 1.0
    this.group.add(this.#inner)
    this.#halo = glowSprite(BEAM_COLOR, 6, 0.18)
    this.#halo.position.y = 1.2
    this.group.add(this.#halo)

    this.#beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.9, 80, 24, 1, true).translate(0, 40, 0),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: BEAM_COLOR.clone() },
          uPower: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uPower;
          varying vec2 vUv;
          void main() {
            float up = vUv.y;
            float fade = pow(1.0 - up, 1.6) * smoothstep(0.0, 0.01, up);
            float streaks = 0.7 + 0.3 * sin(vUv.x * 6.2831853 * 3.0 + uTime * 0.8) * sin(up * 90.0 - uTime * 4.0);
            float alpha = fade * streaks * 0.32 * uPower;
            gl_FragColor = vec4(uColor * alpha * 1.3, alpha);
          }
        `,
      }),
    )
    this.#beam.renderOrder = 4
    this.group.add(this.#beam)

    this.#shock = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.06, 8, 64),
      new THREE.MeshBasicMaterial({
        color: this.#rarity.clone().multiplyScalar(2),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    )
    this.#shock.rotation.x = Math.PI / 2
    this.#shock.position.y = 1.2
    this.group.add(this.#shock)

    this.item = buildItem(reward.item, reward.shiny)
    this.item.visible = false
    this.item.position.y = 1.0
    this.group.add(this.item)

    if (lights) {
      this.#light = new THREE.PointLight(BEAM_COLOR, 6, 12, 2)
      this.#light.position.y = 1.6
      this.group.add(this.#light)
    }
  }

  /** Where the treasure floats once revealed, in world space. */
  itemPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return this.item.getWorldPosition(out)
  }

  /** `opening` counts seconds since the lid began to open; -1 while still closed. */
  update(dt: number, time: number, opening: number, revealed: boolean): void {
    const beam = this.#beam.material as THREE.ShaderMaterial
    uniform(beam.uniforms, 'uTime').value = time
    const pulse = 0.85 + Math.sin(time * 2.4) * 0.15
    this.#halo.material.opacity = 0.15 * pulse
    if (opening < 0) {
      this.#lid.rotation.x = 0
      this.group.rotation.z = 0
      this.#inner.scale.setScalar(1.6 * pulse)
      return
    }
    const t = opening / OPEN_TIME
    // First a shiver, then the lid swings up, then the treasure rises in its own light.
    const shiver = opening < 0.7 ? Math.sin(opening * 60) * 0.03 * (opening / 0.7) : 0
    this.group.rotation.z = shiver
    this.#lid.rotation.x = -2.1 * ease((opening - 0.6) / 0.7)
    const rise = ease((opening - 1.0) / (OPEN_TIME - 1.0))
    this.item.visible = opening > 1.0
    this.item.position.y = 1.0 + rise * 1.25 + (revealed ? Math.sin(time * 2) * 0.08 : 0)
    this.item.scale.setScalar(Math.max(0.001, rise) * 0.9)
    this.item.rotation.y += dt * (revealed ? 1.2 : 4 * (1 - rise) + 1.2)
    const color = BEAM_COLOR.clone().lerp(this.#rarity, clamp(t * 1.4, 0, 1))
    uniform(beam.uniforms, 'uColor').value.copy(color)
    // The pillar thins as the treasure rises, so the treasure itself is what shines.
    uniform(beam.uniforms, 'uPower').value = 1 - rise * 0.45
    ;(this.#seam.material as THREE.MeshBasicMaterial).color.copy(color).multiplyScalar(2.2)
    this.#inner.material.color.copy(color)
    this.#halo.material.color.copy(color)
    this.#inner.scale.setScalar(1.6 + rise * 1.2)
    this.#inner.position.y = 1.0 + rise
    if (this.#light) {
      this.#light.color.copy(color)
      this.#light.intensity = 6 + rise * 6
    }
    if (revealed && this.#revealedAt < 0) this.#revealedAt = time
    const since = this.#revealedAt < 0 ? -1 : time - this.#revealedAt
    const shock = this.#shock.material as THREE.MeshBasicMaterial
    if (since >= 0 && since < 1.2) {
      this.#shock.scale.setScalar(1 + since * 9)
      shock.opacity = 1 - since / 1.2
    } else shock.opacity = 0
  }

  dispose(): void {
    disposeItem(this.item)
    this.group.traverse((object) => {
      if (object === this.item) return
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        ;(object.material as THREE.Material).dispose()
      } else if (object instanceof THREE.Sprite) object.material.dispose()
    })
  }
}
