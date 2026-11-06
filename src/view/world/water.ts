import * as THREE from 'three'
import { noiseTexture } from '../noiseTexture'
import { uniform } from '../uniforms'
import { TERRAIN_SIZE } from './terrain'
import type { WorldTheme } from './themes'

/**
 * Water at a level: clear and bright where shallow, deep in color where deep, with a rim of foam
 * along the shore, ripples, the sky's glow at grazing angles and the sun's glints.
 */
export function buildWater(level: number, theme: WorldTheme, heights: THREE.Texture): THREE.Mesh {
  const colors = theme.water ?? { shallow: 0x7fe0ff, deep: 0x2050c0, foam: 0xffffff }
  const material = new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    depthWrite: false,
    // The textures stay out of the merge, which would clone them: the material would hold
    // copies, and disposing the heights would leave the copy on the GPU.
    uniforms: {
      ...THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      uTime: { value: 0 },
      uLevel: { value: level },
      uShallow: { value: new THREE.Color(colors.shallow) },
      uDeep: { value: new THREE.Color(colors.deep) },
      uFoam: { value: new THREE.Color(colors.foam) },
      uSky: { value: new THREE.Color(theme.sky.horizon) },
      uSun: { value: new THREE.Color(theme.light.sun) },
      uSunDir: { value: new THREE.Vector3(...theme.sky.sunDir).normalize() },
      uHeights: { value: heights },
      uSize: { value: TERRAIN_SIZE },
      uNoise: { value: noiseTexture() },
    },
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uLevel;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uFoam;
      uniform vec3 uSky;
      uniform vec3 uSun;
      uniform vec3 uSunDir;
      uniform sampler2D uHeights;
      uniform float uSize;
      uniform sampler2D uNoise;
      varying vec3 vWorld;
      void main() {
        vec2 uv = vWorld.xz / uSize + 0.5;
        float ground = texture2D(uHeights, uv).r;
        float depth = max(0.0, uLevel - ground);
        vec2 ripple = vWorld.xz * 0.06;
        vec2 n1 = texture2D(uNoise, ripple + vec2(uTime * 0.02, uTime * 0.013)).rg - 0.5;
        vec2 n2 = texture2D(uNoise, ripple * 2.3 - vec2(uTime * 0.017, -uTime * 0.021)).gb - 0.5;
        vec3 normal = normalize(vec3((n1.x + n2.x) * 0.6, 1.0, (n1.y + n2.y) * 0.6));
        vec3 view = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 3.0);
        vec3 color = mix(uShallow, uDeep, smoothstep(0.0, 3.5, depth));
        color = mix(color, uSky, fresnel * 0.55);
        vec3 halfway = normalize(uSunDir + view);
        color += uSun * pow(max(dot(normal, halfway), 0.0), 180.0) * 2.5;
        float shore = 1.0 - smoothstep(0.0, 0.35, depth);
        float wave = texture2D(uNoise, vWorld.xz * 0.15 + vec2(uTime * 0.05, 0.0)).b;
        float foam = shore * smoothstep(0.35, 0.65, wave + shore * 0.4);
        color = mix(color, uFoam, foam * 0.8);
        float alpha = mix(0.55, 0.92, smoothstep(0.0, 2.0, depth)) + fresnel * 0.1;
        alpha *= smoothstep(0.0, 0.06, depth);
        gl_FragColor = vec4(color, alpha);
        #include <fog_fragment>
      }
    `,
  })
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(TERRAIN_SIZE * 2.2, TERRAIN_SIZE * 2.2, 1, 1),
    material,
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = level
  mesh.renderOrder = 1
  return mesh
}

export function updateWater(water: THREE.Mesh, time: number): void {
  uniform((water.material as THREE.ShaderMaterial).uniforms, 'uTime').value = time
}
