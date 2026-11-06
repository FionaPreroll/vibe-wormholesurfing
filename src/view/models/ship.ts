import * as THREE from 'three'
import { uniform } from '../uniforms'
import { roundedShape, smoothLathe, starGeometry } from './shapes'

/** The cute ship, built in code: a chubby body with big eyes, stubby wings and two engines. */
export interface ShipRig {
  readonly group: THREE.Group
  /** Where the girl sits, in the ship's frame. */
  readonly seat: THREE.Object3D
  /** The tips of the wings, for light trails. */
  readonly wingTips: readonly [THREE.Object3D, THREE.Object3D]
  /**
   * Moves the moving parts: `thrust` from 0 to about 2 sets the flames, `bank` and `pitch` lean
   * the ship in radians, `blink` closes its eyes.
   */
  update(dt: number, time: number, state: ShipState): void
  dispose(): void
}

export interface ShipState {
  readonly thrust: number
  readonly bank: number
  readonly pitch: number
  /** 0 to 1: a hit makes the ship flicker. */
  readonly hurt?: number
}

const CREAM = 0xfff4ee
const PINK = 0xff9ccf
const LILAC = 0xb69cff
const GOLD = 0xffd36b

function glossy(
  color: THREE.ColorRepresentation,
  extra: THREE.MeshPhysicalMaterialParameters = {},
) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.32,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    ...extra,
  })
}

/** The body, with its colors painted on: a pink nose, a lilac band and a pale belly. */
function bodyGeometry(): THREE.BufferGeometry {
  const geometry = smoothLathe(
    [
      [0, -1.12],
      [0.24, -1.08],
      [0.44, -0.88],
      [0.56, -0.5],
      [0.6, -0.05],
      [0.56, 0.4],
      [0.46, 0.78],
      [0.3, 1.06],
      [0.12, 1.22],
      [0, 1.26],
    ],
    48,
    60,
  )
  // Lathe height runs along y; the nose points to -z once turned.
  geometry.rotateX(-Math.PI / 2)
  geometry.scale(1, 0.86, 1)
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()
  const cream = new THREE.Color(CREAM)
  const pink = new THREE.Color(PINK)
  const lilac = new THREE.Color(LILAC)
  const belly = new THREE.Color(0xf1e6ff)
  for (let index = 0; index < position.count; index++) {
    const z = position.getZ(index)
    const y = position.getY(index)
    color.copy(cream)
    if (y < -0.12) color.lerp(belly, Math.min(1, (-0.12 - y) * 3))
    if (z < -0.98) color.copy(pink)
    else if (z < -0.92) color.lerp(pink, 0.5)
    if (z > -0.62 && z < -0.5) color.copy(lilac)
    if (z > 0.86) color.copy(lilac)
    colors.set([color.r, color.g, color.b], index * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function wingGeometry(): THREE.BufferGeometry {
  const shape = roundedShape(
    [
      [0, 0.45],
      [1.18, 0.22],
      [1.3, -0.1],
      [0.95, -0.36],
      [0, -0.42],
    ],
    0.2,
  )
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 4,
    curveSegments: 10,
  })
  // Lie flat: the shape's y becomes the ship's z, backward.
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, 0.03, 0)
  geometry.computeVertexNormals()
  return geometry
}

function finGeometry(): THREE.BufferGeometry {
  const shape = roundedShape(
    [
      [-0.22, 0],
      [0.32, 0],
      [0.38, 0.12],
      [0.12, 0.62],
      [-0.06, 0.6],
    ],
    0.1,
  )
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 3,
    curveSegments: 8,
  })
  geometry.rotateY(-Math.PI / 2)
  geometry.translate(0.025, 0, 0)
  geometry.computeVertexNormals()
  return geometry
}

/** A flame that glows brighter toward its root and flickers. */
function flameMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: color }, uPower: { value: 1 } },
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
        float along = vUv.y;
        float flicker = 0.85 + 0.15 * sin(uTime * 41.0 + along * 18.0);
        float core = pow(along, 2.2);
        vec3 color = mix(uColor, vec3(1.0, 0.97, 0.92), core);
        float alpha = pow(along, 1.6) * flicker * uPower;
        gl_FragColor = vec4(color * alpha * 1.4, alpha);
      }
    `,
  })
}

export function buildShip(): ShipRig {
  const group = new THREE.Group()
  group.name = 'ship'
  const hull = new THREE.Group()
  group.add(hull)
  const materials: THREE.Material[] = []
  const geometries: THREE.BufferGeometry[] = []
  const keep = <T extends THREE.Material | THREE.BufferGeometry>(thing: T): T => {
    if (thing instanceof THREE.Material) materials.push(thing)
    else geometries.push(thing)
    return thing
  }

  const bodyMaterial = keep(glossy(0xffffff, { vertexColors: true }))
  const body = new THREE.Mesh(keep(bodyGeometry()), bodyMaterial)
  body.castShadow = true
  body.receiveShadow = true
  hull.add(body)

  // The cockpit: a dark rim on top where the girl sits, with a windshield before her.
  const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(0.3, 0.06, 14, 40)), keep(glossy(LILAC)))
  rim.rotation.x = Math.PI / 2
  rim.scale.set(1, 1.35, 1)
  rim.position.set(0, 0.47, 0.08)
  hull.add(rim)
  const well = new THREE.Mesh(
    keep(new THREE.CircleGeometry(0.3, 32)),
    keep(new THREE.MeshStandardMaterial({ color: 0x2a1d4a, roughness: 0.8 })),
  )
  well.rotation.x = -Math.PI / 2
  well.scale.set(1, 1.35, 1)
  well.position.set(0, 0.46, 0.08)
  hull.add(well)
  const shield = new THREE.Mesh(
    keep(new THREE.SphereGeometry(0.42, 32, 16, Math.PI * 0.18, Math.PI * 0.64, 0.25, 0.85)),
    keep(
      new THREE.MeshPhysicalMaterial({
        color: 0xbff4ff,
        roughness: 0.05,
        transmission: 0,
        transparent: true,
        opacity: 0.32,
        clearcoat: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
  )
  shield.rotation.y = Math.PI
  shield.scale.set(0.9, 0.7, 0.9)
  shield.position.set(0, 0.42, -0.22)
  hull.add(shield)

  const seat = new THREE.Object3D()
  seat.position.set(0, 0.36, 0.14)
  hull.add(seat)

  // Big eyes on the nose, with a little blush: the ship is a friend. Each sits on the hull where
  // a ray from outside meets it, turned to face out along the hull.
  body.updateMatrixWorld(true)
  const caster = new THREE.Raycaster()
  const onHull = (x: number, y: number, z: number) => {
    const origin = new THREE.Vector3(x * 4, y * 4, z)
    caster.set(origin, new THREE.Vector3(-x, -y, 0).normalize())
    const hit = caster.intersectObject(body, false)[0]
    const point = hit?.point ?? new THREE.Vector3(x, y, z)
    const normal = hit?.face?.normal.clone() ?? new THREE.Vector3(x, y, -0.5).normalize()
    return { point, normal }
  }
  const eyeGeometry = keep(new THREE.SphereGeometry(0.11, 24, 16))
  const eyeMaterial = keep(glossy(0x1d1233, { roughness: 0.15 }))
  const sparkleMaterial = keep(new THREE.MeshBasicMaterial({ color: 0xffffff }))
  const blushMaterial = keep(
    new THREE.MeshBasicMaterial({
      color: 0xff6fa8,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  )
  const sparkleGeometry = keep(new THREE.SphereGeometry(0.032, 12, 8))
  const blushGeometry = keep(new THREE.CircleGeometry(0.075, 20))
  const eyes: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    const { point, normal } = onHull(side * 0.42, 0.62, -0.84)
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    eye.position.copy(point).addScaledVector(normal, -0.02)
    eye.lookAt(eye.position.clone().add(normal))
    eye.scale.set(0.78, 1.1, 0.42)
    const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial)
    sparkle.position.set(-0.03 * side, 0.04, 0.09)
    eye.add(sparkle)
    hull.add(eye)
    eyes.push(eye)
    const cheek = onHull(side * 0.7, 0.05, -0.78)
    const blush = new THREE.Mesh(blushGeometry, blushMaterial)
    blush.position.copy(cheek.point).addScaledVector(cheek.normal, 0.006)
    blush.lookAt(blush.position.clone().add(cheek.normal))
    blush.scale.set(1, 0.6, 1)
    hull.add(blush)
  }

  // Stubby wings with glowing tips.
  const wingMaterial = keep(glossy(PINK))
  const wingShape = keep(wingGeometry())
  const tipMaterial = keep(
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ff6ff).multiplyScalar(1.3) }),
  )
  const tipGeometry = keep(new THREE.SphereGeometry(0.07, 16, 10))
  const wingTips: THREE.Object3D[] = []
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingShape, wingMaterial)
    wing.castShadow = true
    wing.scale.x = side
    wing.position.set(side * 0.4, -0.08, 0.2)
    wing.rotation.z = side * 0.14
    hull.add(wing)
    const tip = new THREE.Mesh(tipGeometry, tipMaterial)
    tip.position.set(side * 1.26, 0.03, 0.08)
    wing.add(tip)
    tip.position.x = 1.26
    wingTips.push(tip)
  }

  // A tail fin with a golden star on it.
  const fin = new THREE.Mesh(keep(finGeometry()), keep(glossy(LILAC)))
  fin.position.set(0, 0.33, 0.78)
  fin.castShadow = true
  hull.add(fin)
  const starMaterial = keep(glossy(GOLD, { emissive: GOLD, emissiveIntensity: 0.35 }))
  const finStar = new THREE.Mesh(keep(starGeometry(0.11, 0.05, 0.02)), starMaterial)
  finStar.rotation.y = Math.PI / 2
  finStar.position.set(0, 0.62, 0.9)
  hull.add(finStar)

  // An antenna with a bobbing star.
  const antennaRoot = new THREE.Group()
  antennaRoot.position.set(0.16, 0.48, 0.42)
  hull.add(antennaRoot)
  const stalk = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.012, 0.016, 0.42, 8)),
    keep(glossy(0xe8e0ff)),
  )
  stalk.position.y = 0.21
  antennaRoot.add(stalk)
  const antennaStar = new THREE.Mesh(keep(starGeometry(0.075, 0.035, 0.02)), starMaterial)
  antennaStar.position.y = 0.45
  antennaRoot.add(antennaStar)

  // Two engines with flames behind.
  const podGeometry = keep(new THREE.CapsuleGeometry(0.17, 0.5, 8, 20))
  podGeometry.rotateX(Math.PI / 2)
  const podMaterial = keep(glossy(0xf3eeff))
  const nozzleGeometry = keep(new THREE.TorusGeometry(0.15, 0.045, 12, 28))
  const nozzleMaterial = keep(glossy(LILAC, { metalness: 0.4 }))
  const glowGeometry = keep(new THREE.CircleGeometry(0.14, 24))
  const glowMaterial = keep(
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8ff0ff).multiplyScalar(1.6) }),
  )
  const flameGeometry = keep(new THREE.ConeGeometry(0.15, 1, 20, 1, true))
  // Root at the nozzle, tip away behind; uv.y runs 1 at the root.
  flameGeometry.translate(0, -0.5, 0)
  flameGeometry.rotateX(-Math.PI / 2)
  const flameMaterials = [
    keep(flameMaterial(new THREE.Color(0x56d9ff))),
    keep(flameMaterial(new THREE.Color(0xff79d2))),
  ]
  const flames: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(podGeometry, podMaterial)
    pod.position.set(side * 0.62, -0.12, 0.62)
    pod.castShadow = true
    hull.add(pod)
    const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial)
    nozzle.position.set(0, 0, 0.42)
    pod.add(nozzle)
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    glow.position.set(0, 0, 0.44)
    pod.add(glow)
    for (const [index, material] of flameMaterials.entries()) {
      const flame = new THREE.Mesh(flameGeometry, material)
      flame.position.set(0, 0, 0.44)
      flame.scale.setScalar(index === 0 ? 1 : 0.6)
      flame.renderOrder = 5
      pod.add(flame)
      flames.push(flame)
    }
  }

  let antennaAngle = 0
  let antennaSpeed = 0
  let blinkTimer = 2
  let lastBank = 0

  return {
    group,
    seat,
    wingTips: wingTips as [THREE.Object3D, THREE.Object3D],
    update(dt, time, { thrust, bank, pitch, hurt = 0 }) {
      hull.rotation.z = -bank
      hull.rotation.x = pitch
      // A gentle bob, as if the ship breathed.
      hull.position.y = Math.sin(time * 2.1) * 0.035
      for (const [index, flame] of flames.entries()) {
        const big = index % 2 === 0
        const length = (big ? 0.5 : 0.35) + thrust * (big ? 0.55 : 0.35)
        const wobble = 1 + Math.sin(time * 37 + index * 1.7) * 0.06
        flame.scale.set(big ? 1 : 0.6, big ? 1 : 0.6, length * wobble)
        const material = flame.material as THREE.ShaderMaterial
        uniform(material.uniforms, 'uTime').value = time
        uniform(material.uniforms, 'uPower').value = 0.55 + Math.min(1.2, thrust) * 0.5
      }
      // The antenna lags behind turns on a spring.
      const push = (bank - lastBank) / Math.max(dt, 1e-3)
      lastBank = bank
      antennaSpeed += (-antennaAngle * 60 - antennaSpeed * 6 - push * 0.9) * dt
      antennaAngle += antennaSpeed * dt
      antennaRoot.rotation.z = antennaAngle * 0.5 + Math.sin(time * 3) * 0.05
      antennaStar.rotation.y = time * 1.5
      blinkTimer -= dt
      const closed = blinkTimer < 0.12
      if (blinkTimer < 0) blinkTimer = 2 + ((time * 7.31) % 3)
      for (const eye of eyes) eye.scale.y = closed ? 0.12 : 1.1
      bodyMaterial.emissive.setRGB(hurt * 0.25, hurt * 0.4, hurt * 0.7)
    },
    dispose() {
      for (const material of materials) material.dispose()
      for (const geometry of geometries) geometry.dispose()
    },
  }
}
