import * as THREE from 'three'
import { faceTexture, paintFace } from './face'
import { starGeometry, taperTube } from './shapes'
import { outline, toon } from './toon'

/** What the girl is doing, which sets her pose. */
export type GirlMode = 'sit' | 'stand' | 'walk' | 'air' | 'cheer' | 'wave' | 'swim'

export interface GirlState {
  readonly mode: GirlMode
  /** Walking speed as a share of full speed. */
  readonly pace?: number
  /** Wind from ahead, 0 to about 2: hair and scarf stream back. */
  readonly wind?: number
  /** Sideways lean in radians, as when the ship banks. */
  readonly lean?: number
  /** Vertical speed, so hair lifts on the way down. */
  readonly rise?: number
  /** Where she looks, in radians to the side. */
  readonly look?: number
}

export interface GirlRig {
  /** Origin between her feet; she faces +z. */
  readonly group: THREE.Group
  update(dt: number, time: number, state: GirlState): void
  dispose(): void
}

const HAIR = 0xff9fd4
const JACKET = 0xa98bff
const DRESS = 0xfffaff
const SCARF = 0xffd36b
const BOOT = 0xffffff
const SKIN = 0xffe6da

/** A point on the head's sphere: `around` from the front, `down` from the top. */
function onHead(radius: number, around: number, down: number, out = 0): THREE.Vector3 {
  const r = radius + out
  return new THREE.Vector3(
    r * Math.sin(around) * Math.sin(down),
    r * Math.cos(down),
    r * Math.cos(around) * Math.sin(down),
  )
}

/** A damped spring for hair and scarf, chasing a target angle. */
class Spring {
  value = 0
  speed = 0
  constructor(
    readonly stiffness = 40,
    readonly damping = 6,
  ) {}
  step(target: number, dt: number): number {
    this.speed += ((target - this.value) * this.stiffness - this.speed * this.damping) * dt
    this.value += this.speed * dt
    return this.value
  }
}

export function buildGirl(): GirlRig {
  const group = new THREE.Group()
  group.name = 'girl'
  const root = new THREE.Group()
  group.add(root)
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const textures: THREE.Texture[] = []
  const geo = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.push(geometry)
    return geometry
  }
  const mat = <T extends THREE.Material>(material: T): T => {
    materials.push(material)
    return material
  }
  const part = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Object3D,
    line = 0.01,
  ) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    if (line > 0) outline(mesh, line)
    parent.add(mesh)
    return mesh
  }

  // A warm glow keeps skin rosy under the cool light of space.
  const skin = mat(toon(SKIN, { emissive: 0x3a1c12 }))
  const hair = mat(toon(HAIR))
  const jacket = mat(toon(JACKET))
  const boots = mat(toon(BOOT))
  const gold = mat(toon(SCARF, { emissive: 0x5a3a00 }))
  const scarf = mat(toon(SCARF))

  // Legs, hinged at the hips, with chunky boots.
  const legs: THREE.Group[] = []
  const legGeometry = geo(new THREE.CapsuleGeometry(0.058, 0.3, 6, 14))
  const bootGeometry = geo(new THREE.SphereGeometry(0.078, 20, 14))
  const soleGeometry = geo(new THREE.CylinderGeometry(0.075, 0.08, 0.035, 18))
  const sole = mat(toon(0xff8fc8))
  for (const side of [-1, 1]) {
    const hip = new THREE.Group()
    hip.position.set(side * 0.078, 0.47, 0)
    root.add(hip)
    const leg = part(legGeometry, skin, hip, 0.008)
    leg.position.y = -0.2
    const boot = part(bootGeometry, boots, hip, 0.008)
    boot.scale.set(1, 0.95, 1.35)
    boot.position.set(0, -0.4, 0.025)
    const bootSole = part(soleGeometry, sole, hip, 0)
    bootSole.position.set(0, -0.455, 0.03)
    bootSole.scale.set(1, 1, 1.3)
    legs.push(hip)
  }

  // A flared skirt with a pink hem and a lilac waistband.
  const skirtGeometry = geo(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.06, 0.66),
        new THREE.Vector2(0.14, 0.665),
        new THREE.Vector2(0.155, 0.62),
        new THREE.Vector2(0.2, 0.53),
        new THREE.Vector2(0.27, 0.43),
        new THREE.Vector2(0.305, 0.37),
        new THREE.Vector2(0.3, 0.355),
      ],
      36,
    ),
  )
  {
    const position = skirtGeometry.getAttribute('position') as THREE.BufferAttribute
    const colors = new Float32Array(position.count * 3)
    const color = new THREE.Color()
    for (let index = 0; index < position.count; index++) {
      const y = position.getY(index)
      color.set(y < 0.4 ? 0xff9fd4 : y > 0.625 ? JACKET : DRESS)
      colors.set([color.r, color.g, color.b], index * 3)
    }
    skirtGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }
  const skirtMaterial = mat(toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide }))
  const skirt = part(skirtGeometry, skirtMaterial, root, 0.008)

  // Upper body: jacket, puffed sleeves, a star badge and a scarf.
  const torso = new THREE.Group()
  torso.position.y = 0.66
  root.add(torso)
  const chest = part(geo(new THREE.SphereGeometry(0.15, 28, 20)), jacket, torso)
  chest.scale.set(1, 1.2, 0.86)
  chest.position.y = 0.1
  const badge = part(geo(starGeometry(0.04, 0.018, 0.012)), gold, torso, 0)
  badge.position.set(0.055, 0.14, 0.125)
  badge.rotation.x = -0.25
  const neck = part(geo(new THREE.CylinderGeometry(0.04, 0.045, 0.08, 12)), skin, torso, 0)
  neck.position.y = 0.28
  const scarfRing = part(geo(new THREE.TorusGeometry(0.115, 0.045, 12, 28)), scarf, torso, 0.008)
  scarfRing.rotation.x = Math.PI / 2 - 0.12
  scarfRing.position.set(0, 0.245, 0.01)
  const scarfPivot = new THREE.Group()
  scarfPivot.name = 'scarf'
  scarfPivot.position.set(-0.05, 0.25, -0.09)
  torso.add(scarfPivot)
  part(
    geo(
      taperTube(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(-0.03, -0.05, -0.08),
          new THREE.Vector3(-0.05, -0.12, -0.15),
          new THREE.Vector3(-0.06, -0.2, -0.2),
        ],
        [0.035, 0.045, 0.04, 0.012],
        16,
        10,
      ),
    ),
    scarf,
    scarfPivot,
    0.006,
  ).scale.set(1, 1, 1)

  const arms: THREE.Group[] = []
  const armGeometry = geo(new THREE.CapsuleGeometry(0.043, 0.22, 6, 12))
  const sleeveGeometry = geo(new THREE.SphereGeometry(0.075, 18, 14))
  const handGeometry = geo(new THREE.SphereGeometry(0.052, 16, 12))
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.155, 0.2, 0)
    torso.add(shoulder)
    const sleeve = part(sleeveGeometry, jacket, shoulder, 0.008)
    sleeve.scale.set(1, 1.05, 1)
    const arm = part(armGeometry, skin, shoulder, 0.007)
    arm.position.y = -0.17
    const hand = part(handGeometry, skin, shoulder, 0.007)
    hand.position.y = -0.31
    arms.push(shoulder)
  }

  // The head, with its painted face, and the hair around it.
  const head = new THREE.Group()
  head.position.y = 0.57
  torso.add(head)
  const headRadius = 0.33
  const faces = {
    open: faceTexture(paintFace(false)),
    closed: faceTexture(paintFace(true)),
    happy: faceTexture(paintFace(false, true)),
  }
  textures.push(faces.open, faces.closed, faces.happy)
  const faceMaterial = mat(toon(0xffffff, { map: faces.open, emissive: 0x3a1c12 }))
  const skull = part(geo(new THREE.SphereGeometry(headRadius, 48, 32)), faceMaterial, head, 0.012)
  skull.scale.set(1.04, 0.97, 1)
  skull.position.y = 0.0
  const center = new THREE.Vector3(0, 0.0, 0)

  const cap = part(
    geo(new THREE.SphereGeometry(headRadius + 0.03, 48, 24, 0, Math.PI * 2, 0, 1.32)),
    hair,
    head,
    0.012,
  )
  cap.position.set(0, 0.025, -0.012)
  cap.scale.set(1.05, 1, 1.02)
  const back = part(
    geo(
      new THREE.SphereGeometry(
        headRadius + 0.035,
        48,
        24,
        Math.PI / 2 + 1.0,
        Math.PI * 2 - 2.0,
        1.1,
        1.55,
      ),
    ),
    hair,
    head,
    0.012,
  )
  back.position.set(0, 0.0, -0.02)
  back.scale.set(1.06, 1.02, 1.05)
  ;(back.material as THREE.Material).side = THREE.DoubleSide

  // A fringe of soft strands over the forehead, and locks beside the cheeks.
  const strand = (around: number, from: number, to: number, out: number, radii: number[]) => {
    const top = onHead(headRadius, around, from, 0.03)
    const middle = onHead(headRadius, around, (from + to) / 2, out * 0.8 + 0.035)
    const tip = onHead(headRadius, around, to, out + 0.02)
    tip.y -= 0.02
    const mesh = part(geo(taperTube([top, middle, tip], radii, 16, 10)), hair, head, 0.006)
    mesh.position.copy(center)
    return mesh
  }
  for (const [index, around] of [-0.8, -0.56, -0.33, -0.11, 0.11, 0.33, 0.56, 0.8].entries()) {
    const long = index % 3 === 0 ? 0.1 : index % 3 === 1 ? 0.02 : 0.06
    strand(around, 0.6, 1.28 + long, 0.022, [0.075, 0.08, 0.055, 0.01])
  }
  for (const side of [-1, 1]) strand(side * 1.12, 0.9, 2.15, 0.03, [0.065, 0.07, 0.055, 0.012])

  // A single strand sticking up on top.
  const ahoge = part(
    geo(
      taperTube(
        [
          new THREE.Vector3(0, headRadius, 0.02),
          new THREE.Vector3(0.02, headRadius + 0.11, 0.06),
          new THREE.Vector3(0.07, headRadius + 0.16, 0.13),
          new THREE.Vector3(0.12, headRadius + 0.11, 0.17),
        ],
        [0.026, 0.022, 0.014, 0.003],
        16,
        8,
      ),
    ),
    hair,
    head,
    0.006,
  )
  ahoge.position.y = 0.02

  // Twin tails on springs, tied with golden stars.
  const tails: THREE.Group[] = []
  const tailGeometry = geo(
    taperTube(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.11, -0.03, -0.05),
        new THREE.Vector3(0.19, -0.2, -0.09),
        new THREE.Vector3(0.17, -0.44, -0.07),
        new THREE.Vector3(0.09, -0.62, 0),
      ],
      [0.07, 0.11, 0.1, 0.07, 0.014],
      28,
      14,
    ),
  )
  const tieGeometry = geo(new THREE.TorusGeometry(0.055, 0.024, 10, 20))
  const tieStar = geo(starGeometry(0.06, 0.028, 0.016))
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.name = 'twin-tail'
    pivot.position.set(side * 0.27, 0.11, -0.12)
    head.add(pivot)
    const tail = part(tailGeometry, hair, pivot, 0.01)
    tail.scale.x = side
    const tie = part(tieGeometry, gold, pivot, 0)
    tie.rotation.set(0.3, side * 1.2, 0)
    const star = part(tieStar, gold, pivot, 0)
    star.position.set(side * 0.03, 0.05, 0.02)
    star.rotation.set(0, side * 0.8, side * -0.2)
    tails.push(pivot)
  }

  const tailSprings = [new Spring(38, 5), new Spring(38, 5)]
  const tailSide = [new Spring(30, 5), new Spring(30, 5)]
  const scarfSpring = new Spring(30, 4)
  const headSpring = new Spring(20, 7)
  let walkPhase = 0
  let blink = 1.5
  let lastMode: GirlMode = 'stand'

  return {
    group,
    update(dt, time, { mode, pace = 0, wind = 0, lean = 0, rise = 0, look = 0 }) {
      lastMode = mode
      const breath = Math.sin(time * 2.2)
      walkPhase += dt * (4 + pace * 7.5) * (mode === 'walk' ? 1 : mode === 'swim' ? 0.55 : 0)
      const swing = Math.sin(walkPhase)
      let hop = 0
      root.rotation.set(0, 0, 0)
      torso.rotation.set(0, 0, 0)
      const [left, right] = legs as [THREE.Group, THREE.Group]
      const [leftArm, rightArm] = arms as [THREE.Group, THREE.Group]
      switch (mode) {
        case 'sit':
          left.rotation.set(-1.45, 0, 0.08)
          right.rotation.set(-1.45, 0, -0.08)
          leftArm.rotation.set(-1.05 + breath * 0.02, 0, -0.25)
          rightArm.rotation.set(-1.05 - breath * 0.02, 0, 0.25)
          torso.rotation.z = lean * 0.35
          torso.rotation.x = 0.12 + Math.min(0.25, wind * 0.08)
          break
        case 'walk': {
          const stride = 0.35 + pace * 0.55
          left.rotation.set(swing * stride, 0, 0)
          right.rotation.set(-swing * stride, 0, 0)
          leftArm.rotation.set(-swing * stride * 0.9, 0, -0.18)
          rightArm.rotation.set(swing * stride * 0.9, 0, 0.18)
          hop = Math.abs(Math.cos(walkPhase)) * 0.045 * pace
          torso.rotation.x = 0.06 + pace * 0.1
          torso.rotation.z = swing * 0.04
          break
        }
        case 'swim': {
          // Treading water: legs kick, arms sweep in wide strokes just under the surface.
          const kick = Math.sin(walkPhase * 2)
          left.rotation.set(0.35 + kick * 0.35, 0, 0.12)
          right.rotation.set(0.35 - kick * 0.35, 0, -0.12)
          const stroke = Math.sin(walkPhase)
          leftArm.rotation.set(-0.9 - stroke * 0.3, 0, -1.0 - Math.cos(walkPhase) * 0.45)
          rightArm.rotation.set(-0.9 - stroke * 0.3, 0, 1.0 + Math.cos(walkPhase) * 0.45)
          torso.rotation.x = 0.25 + pace * 0.2
          hop = Math.sin(time * 2.4) * 0.03
          break
        }
        case 'air':
          left.rotation.set(-0.7, 0, 0.1)
          right.rotation.set(0.25, 0, -0.1)
          leftArm.rotation.set(-0.3, 0, -1.1)
          rightArm.rotation.set(-0.3, 0, 1.1)
          break
        case 'cheer': {
          const bounce = Math.abs(Math.sin(time * 6.5))
          hop = bounce * 0.12
          left.rotation.set(-bounce * 0.4, 0, 0.06)
          right.rotation.set(-bounce * 0.4, 0, -0.06)
          leftArm.rotation.set(0, 0, -2.6 - Math.sin(time * 13) * 0.15)
          rightArm.rotation.set(0, 0, 2.6 + Math.sin(time * 13) * 0.15)
          break
        }
        case 'wave':
          left.rotation.set(0, 0, 0.04)
          right.rotation.set(0, 0, -0.04)
          leftArm.rotation.set(0, 0, -0.2)
          rightArm.rotation.set(0, 0, 2.5 + Math.sin(time * 9) * 0.35)
          break
        default:
          left.rotation.set(0, 0, 0.04)
          right.rotation.set(0, 0, -0.04)
          leftArm.rotation.set(Math.sin(time * 1.3) * 0.05, 0, -0.16 - breath * 0.03)
          rightArm.rotation.set(-Math.sin(time * 1.3) * 0.05, 0, 0.16 + breath * 0.03)
      }
      root.position.y = hop
      torso.scale.set(1, 1 + breath * 0.012, 1)
      skirt.scale.set(1 + Math.abs(swing) * 0.03 * pace, 1, 1)

      // The head looks around a little and leans with her.
      const lookTarget = look + (mode === 'stand' ? Math.sin(time * 0.6) * 0.25 : 0)
      head.rotation.y = headSpring.step(lookTarget, dt)
      head.rotation.z = -lean * 0.2 + (mode === 'cheer' ? Math.sin(time * 6.5) * 0.08 : 0)
      head.rotation.x = mode === 'sit' ? -0.1 : 0

      // Hair and scarf stream back in the wind and bounce with each step. She faces +z, so a
      // positive turn about x swings what hangs from a pivot back, behind her.
      const flutter = Math.sin(time * 17) * 0.06 * Math.min(1.5, wind)
      for (const [index, pivot] of tails.entries()) {
        const side = index === 0 ? -1 : 1
        const back = wind * 0.75 - rise * 0.04 + hop * 2
        const bob = mode === 'walk' ? Math.cos(walkPhase * 2) * 0.12 * pace : 0
        pivot.rotation.x =
          (tailSprings[index] as Spring).step(back + bob, dt) + flutter * (1 + index * 0.5)
        pivot.rotation.z =
          (tailSide[index] as Spring).step(side * (0.05 + wind * 0.15) - lean * 0.6, dt) +
          Math.sin(time * 1.4 + index) * 0.03
      }
      scarfPivot.rotation.x = scarfSpring.step(-0.2 + wind * 0.9, dt) + flutter * 2
      ahoge.rotation.z = Math.sin(time * 3.1) * 0.08

      blink -= dt
      const happy = mode === 'cheer' || mode === 'wave'
      const face = happy ? faces.happy : blink < 0.13 ? faces.closed : faces.open
      if (faceMaterial.map !== face) {
        faceMaterial.map = face
        faceMaterial.needsUpdate = true
      }
      if (blink < 0) blink = 1.8 + ((time * 13.7) % 2.6)
      void lastMode
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      for (const texture of textures) texture.dispose()
    },
  }
}
