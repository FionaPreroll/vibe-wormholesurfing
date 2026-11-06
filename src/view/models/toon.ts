import * as THREE from 'three'

let gradient: THREE.DataTexture | undefined

/** Three soft bands of light, for the anime look of the girl and her things. */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient
  const steps = [90, 160, 225, 255]
  const data = new Uint8Array(steps.length * 4)
  steps.forEach((value, index) => {
    data.set([value, value, value, 255], index * 4)
  })
  gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat)
  gradient.minFilter = THREE.NearestFilter
  gradient.magFilter = THREE.NearestFilter
  gradient.generateMipmaps = false
  gradient.needsUpdate = true
  return gradient
}

export function toon(
  color: THREE.ColorRepresentation,
  extra: THREE.MeshToonMaterialParameters = {},
) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra })
}

const outlines = new Map<string, THREE.ShaderMaterial>()

/** A dark line around a shape: its back faces, pushed out along the normals. */
export function outlineMaterial(thickness: number, color = 0x2a1838): THREE.ShaderMaterial {
  const key = `${thickness}:${color}`
  let material = outlines.get(key)
  if (!material) {
    material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uThickness: { value: thickness }, uColor: { value: new THREE.Color(color) } },
      vertexShader: /* glsl */ `
        uniform float uThickness;
        void main() {
          vec3 pushed = position + normal * uThickness;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pushed, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        void main() { gl_FragColor = vec4(uColor, 1.0); }
      `,
    })
    // Every girl shares it, in every stage: a stage that goes away must not dispose it, or the
    // next would compile it again in its first frame.
    material.userData.shared = true
    outlines.set(key, material)
  }
  return material
}

/** Adds an outline to a mesh, as a child that follows it. */
export function outline<T extends THREE.Mesh>(mesh: T, thickness = 0.012): T {
  const line = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness))
  line.name = 'outline'
  line.castShadow = false
  line.receiveShadow = false
  mesh.add(line)
  return mesh
}

/** Disposes a mesh's materials, except those every stage shares (`userData.shared`). */
export function disposeMaterials(material: THREE.Material | THREE.Material[]): void {
  for (const entry of Array.isArray(material) ? material : [material]) {
    if (!entry.userData.shared) entry.dispose()
  }
}
