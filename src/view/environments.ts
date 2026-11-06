import * as THREE from 'three'

/**
 * Reflections, which three.js renders into a cube and blurs (PMREM). Making them costs: the
 * generator compiles its blur shaders, and the scene renders six times. So the generator lives as
 * long as the renderer, the ride's space is made once, and a world's sky has its shader compiled
 * alongside frames before it is rendered. Their render targets are what must be disposed:
 * disposing only a target's texture frees nothing on the GPU.
 */

const generators = new WeakMap<THREE.WebGLRenderer, THREE.PMREMGenerator>()
const spaces = new WeakMap<THREE.WebGLRenderer, THREE.WebGLRenderTarget>()

/** The renderer's one generator: disposing it would drop its shaders, compiled again next time. */
export function pmremFor(renderer: THREE.WebGLRenderer): THREE.PMREMGenerator {
  let generator = generators.get(renderer)
  if (!generator) {
    generator = new THREE.PMREMGenerator(renderer)
    generators.set(renderer, generator)
  }
  return generator
}

/** Space as seen from a ship, the same for every ride and title screen: made once. */
export function spaceEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  let target = spaces.get(renderer)
  if (!target) {
    target = makeSpace(renderer)
    spaces.set(renderer, target)
  }
  return target.texture
}

function makeSpace(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const scene = new THREE.Scene()
  const geometry = new THREE.SphereGeometry(10, 32, 16)
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec3 top = vec3(0.55, 0.5, 1.2);
        vec3 bottom = vec3(0.12, 0.05, 0.3);
        vec3 color = mix(bottom, top, vDir.y * 0.5 + 0.5);
        color += vec3(1.2, 0.5, 1.0) * pow(max(0.0, dot(vDir, normalize(vec3(-0.6, 0.3, -0.7)))), 6.0);
        color += vec3(0.4, 1.0, 1.4) * pow(max(0.0, dot(vDir, normalize(vec3(0.7, 0.2, 0.6)))), 8.0);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
  scene.add(new THREE.Mesh(geometry, material))
  const target = pmremFor(renderer).fromScene(scene, 0.02)
  geometry.dispose()
  material.dispose()
  return target
}

/**
 * A world's sky as reflections. `compile` makes its shader ready first, alongside frames, so that
 * rendering it into the cube stalls nothing.
 */
export async function skyEnvironment(
  renderer: THREE.WebGLRenderer,
  sky: THREE.Mesh,
  compile: (scene: THREE.Scene, camera: THREE.Camera) => Promise<void>,
): Promise<THREE.WebGLRenderTarget> {
  const scene = new THREE.Scene()
  scene.add(sky)
  await compile(scene, new THREE.PerspectiveCamera())
  return pmremFor(renderer).fromScene(scene, 0.04)
}

/** After a lost context, or with the renderer: what was made is gone. */
export function disposeEnvironments(renderer: THREE.WebGLRenderer): void {
  spaces.get(renderer)?.dispose()
  spaces.delete(renderer)
  generators.get(renderer)?.dispose()
  generators.delete(renderer)
}
