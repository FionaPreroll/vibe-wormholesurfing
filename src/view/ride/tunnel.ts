import * as THREE from 'three'
import { noiseTexture } from '../noiseTexture'
import { BEND_GLSL } from './bend'

export const TUNNEL_RADIUS = 21
export const TUNNEL_LENGTH = 1000

/** Shared uniforms of everything that moves with the ride. */
export interface RideUniforms {
  readonly uTravel: { value: number }
  readonly uTime: { value: number }
  readonly uSpeed: { value: number }
  readonly uBend: { value: THREE.Vector2 }
  readonly uNoise: { value: THREE.Texture }
  /** Hue shift of the whole tunnel, 0 to 1, for variety and warps. */
  readonly uHue: { value: number }
  /** A glow that rises as the ship falls into a hole. */
  readonly uWarp: { value: number }
}

export function rideUniforms(): RideUniforms {
  return {
    uTravel: { value: 0 },
    uTime: { value: 0 },
    uSpeed: { value: 1 },
    uBend: { value: new THREE.Vector2() },
    uNoise: { value: noiseTexture() },
    uHue: { value: 0 },
    uWarp: { value: 0 },
  }
}

const TUNNEL_VERTEX = /* glsl */ `
${BEND_GLSL}
varying float vAngle;
varying float vDepth;
varying float vRadius;
void main() {
  vec3 p = position;
  float depth = -p.z;
  vAngle = atan(p.y, p.x);
  vDepth = depth;
  vRadius = length(p.xy);
  p.xy += bendAt(depth);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const HUE = /* glsl */ `
vec3 hueShift(vec3 color, float shift) {
  const vec3 k = vec3(0.57735);
  float angle = shift * 6.2831853;
  float c = cos(angle);
  return color * c + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - c);
}
`

const TUNNEL_FRAGMENT = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTravel;
uniform float uTime;
uniform float uSpeed;
uniform float uHue;
uniform float uWarp;
varying float vAngle;
varying float vDepth;
varying float vRadius;
${HUE}
void main() {
  float a = vAngle / 6.2831853;
  float z = vDepth + uTravel;
  float twist = vDepth * 0.0011 + uTime * 0.012;
  vec2 warpUv = vec2(a * 2.0 + twist, z * 0.0025);
  vec2 warp = texture2D(uNoise, warpUv).rg - 0.5;
  vec2 cloudUv = vec2(a * 2.0 + twist * 1.6 + warp.x * 0.5, z * 0.0055 + warp.y * 0.35);
  float clouds = texture2D(uNoise, cloudUv).r;
  float detail = texture2D(uNoise, cloudUv * vec2(2.0, 2.6) + vec2(0.37, 0.11)).g;
  float fine = texture2D(uNoise, cloudUv * vec2(5.0, 7.0) + vec2(0.71, 0.29)).b;
  float filaments = texture2D(uNoise, vec2(a * 8.0 + warp.x * 0.25, z * 0.0006 + warp.y * 0.1)).a;
  float swirl = texture2D(uNoise, vec2(a * 1.0 - twist * 0.7 + z * 0.0004, z * 0.0007)).r;

  vec3 deep = vec3(0.012, 0.014, 0.06);
  vec3 indigo = vec3(0.06, 0.05, 0.24);
  vec3 blue = vec3(0.1, 0.22, 0.6);
  vec3 violet = vec3(0.34, 0.12, 0.62);
  vec3 magenta = vec3(0.85, 0.28, 0.85);
  vec3 cyan = vec3(0.3, 0.8, 1.0);

  float body = clouds * 0.65 + detail * 0.35;
  vec3 color = mix(deep, indigo, smoothstep(0.2, 0.6, body));
  color = mix(color, blue, smoothstep(0.55, 0.9, swirl) * 0.5);
  float bright = smoothstep(0.55, 0.92, body + fine * 0.12);
  color = mix(color, violet, bright * 0.7);
  color += magenta * pow(bright, 3.0) * 0.45;
  float threads = filaments * smoothstep(0.35, 0.8, clouds);
  color += cyan * threads * (0.25 + uSpeed * 0.2);
  color += vec3(1.0, 0.85, 1.0) * pow(fine, 14.0) * 0.5;
  // The walls darken close by, where the camera sees them flat and large.
  color *= smoothstep(-40.0, 60.0, vDepth) * 0.75 + 0.25;

  // The far end fades into the deep blue of the background, so the tunnel has no end to see.
  float far = smoothstep(220.0, 880.0, vDepth);
  color = mix(color, vec3(0.02, 0.024, 0.1), far);
  color *= 1.0 + uWarp * 2.5;
  color = hueShift(color, uHue);
  gl_FragColor = vec4(color, 1.0);
}
`

const VEIL_FRAGMENT = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTravel;
uniform float uTime;
uniform float uSpeed;
uniform float uHue;
uniform float uWarp;
uniform float uLayer;
varying float vAngle;
varying float vDepth;
varying float vRadius;
${HUE}
void main() {
  float a = vAngle / 6.2831853;
  float z = vDepth + uTravel * (1.15 + uLayer * 0.2);
  vec2 uv = vec2(a * 2.0 - uTime * 0.01 * (1.0 + uLayer) + uLayer * 0.33, z * 0.0021);
  vec2 warp = texture2D(uNoise, uv * 0.7 + 0.5).rg - 0.5;
  float wisps = texture2D(uNoise, uv + warp * 0.4).r;
  float thin = texture2D(uNoise, uv * vec2(1.5, 3.0) + warp * 0.2).g;
  float alpha = smoothstep(0.62, 0.95, wisps * 0.7 + thin * 0.35) * 0.7;
  alpha *= smoothstep(-10.0, 25.0, vDepth) * (1.0 - smoothstep(350.0, 700.0, vDepth));
  vec3 color = mix(vec3(0.35, 0.25, 0.95), vec3(0.9, 0.45, 1.0), thin);
  color = mix(color, vec3(0.4, 0.9, 1.0), uLayer * 0.5);
  color *= 0.4 + uWarp * 2.0;
  color = hueShift(color, uHue);
  gl_FragColor = vec4(color * alpha, alpha);
}
`

/** The wormhole's walls, and two veils of thin clouds that drift inside them. */
export function buildTunnel(uniforms: RideUniforms): THREE.Group {
  const group = new THREE.Group()
  const geometry = new THREE.CylinderGeometry(
    TUNNEL_RADIUS,
    TUNNEL_RADIUS,
    TUNNEL_LENGTH,
    72,
    140,
    true,
  )
  geometry.rotateX(Math.PI / 2)
  // Run from just behind the camera far ahead.
  geometry.translate(0, 0, -TUNNEL_LENGTH / 2 + 60)
  const walls = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: { ...uniforms },
      vertexShader: TUNNEL_VERTEX,
      fragmentShader: TUNNEL_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  )
  walls.frustumCulled = false
  walls.renderOrder = -10
  group.add(walls)

  for (const [layer, radius] of [
    [0, 15],
    [1, 11.5],
  ] as const) {
    const veilGeometry = new THREE.CylinderGeometry(radius, radius, 760, 56, 90, true)
    veilGeometry.rotateX(Math.PI / 2)
    veilGeometry.translate(0, 0, -380 + 40)
    const veil = new THREE.Mesh(
      veilGeometry,
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uLayer: { value: layer } },
        vertexShader: TUNNEL_VERTEX,
        fragmentShader: VEIL_FRAGMENT,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    veil.frustumCulled = false
    veil.renderOrder = -9 + layer
    group.add(veil)
  }
  return group
}

export { HUE }
