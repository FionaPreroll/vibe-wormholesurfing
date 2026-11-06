import * as THREE from 'three'
import { HASH } from '../glsl'
import { noiseTexture } from '../noiseTexture'
import { uniform } from '../uniforms'
import type { WorldTheme } from './themes'

/**
 * The sky around a world: a gradient from horizon to zenith, the sun and its glow, clouds, stars,
 * an aurora and a planet, each as much as the theme asks for.
 */
export function buildSky(theme: WorldTheme): THREE.Mesh {
  const sky = theme.sky
  const planet = sky.planet
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(sky.zenith) },
      uHorizon: { value: new THREE.Color(sky.horizon) },
      uBelow: { value: new THREE.Color(sky.below) },
      uSun: { value: new THREE.Color(sky.sun) },
      uSunDir: { value: new THREE.Vector3(...sky.sunDir).normalize() },
      uSunSize: { value: sky.sunSize },
      uStars: { value: sky.stars },
      uAurora: { value: sky.aurora },
      uClouds: { value: sky.clouds },
      uPlanetDir: { value: new THREE.Vector3(...(planet?.dir ?? [0, -1, 0])).normalize() },
      uPlanetSize: { value: planet?.size ?? 0 },
      uPlanetColor: { value: new THREE.Color(planet?.color ?? 0) },
      uTime: { value: 0 },
      uNoise: { value: noiseTexture() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uBelow;
      uniform vec3 uSun;
      uniform vec3 uSunDir;
      uniform float uSunSize;
      uniform float uStars;
      uniform float uAurora;
      uniform float uClouds;
      uniform vec3 uPlanetDir;
      uniform float uPlanetSize;
      uniform vec3 uPlanetColor;
      uniform float uTime;
      uniform sampler2D uNoise;
      varying vec3 vDir;
      ${HASH}
      void main() {
        vec3 dir = normalize(vDir);
        float up = dir.y;
        vec3 color = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.85, up), 0.6));
        color = mix(uBelow, color, smoothstep(-0.12, 0.02, up));
        float sunAmount = max(dot(dir, uSunDir), 0.0);
        color += uSun * pow(sunAmount, 8.0) * 0.35;
        color += uSun * pow(sunAmount, 64.0) * 0.6;
        if (uSunSize > 0.0) color += uSun * smoothstep(1.0 - uSunSize * 0.02, 1.0 - uSunSize * 0.015, sunAmount) * 6.0;

        // Stars, twinkling, fading toward the horizon.
        if (uStars > 0.0) {
          vec2 cell = floor(vec2(atan(dir.z, dir.x + 1e-6) * 220.0, asin(clamp(dir.y, -1.0, 1.0)) * 220.0));
          float star = hash12(cell);
          float twinkle = 0.6 + 0.4 * sin(uTime * (1.0 + star * 4.0) + star * 50.0);
          float bright = step(0.9965, star) * twinkle * smoothstep(-0.05, 0.3, up);
          color += vec3(0.9, 0.95, 1.0) * bright * uStars * 1.6;
          // A faint band of the galaxy.
          float band = exp(-pow(dot(dir, normalize(vec3(0.3, 0.6, -0.74))) * 4.0, 2.0));
          float dust = texture2D(uNoise, vec2(atan(dir.z, dir.x + 1e-6) * 0.4, dir.y * 0.8)).r;
          color += vec3(0.35, 0.3, 0.6) * band * dust * uStars * 0.35;
        }

        // Drifting clouds, painted on a dome over the land.
        if (uClouds > 0.0 && up > 0.0) {
          vec2 plane = dir.xz / (up + 0.12) * 0.25 + vec2(uTime * 0.004, uTime * 0.002);
          float c = texture2D(uNoise, plane).r * 0.65 + texture2D(uNoise, plane * 2.7 + 0.3).g * 0.35;
          float cover = smoothstep(0.5, 0.82, c) * smoothstep(0.0, 0.25, up) * uClouds;
          vec3 cloudColor = mix(uHorizon * 1.08, vec3(1.0), 0.45) + uSun * pow(sunAmount, 4.0) * 0.4;
          color = mix(color, cloudColor, cover * 0.85);
        }

        // An aurora: curtains of green, cyan and violet that sway.
        if (uAurora > 0.0) {
          float angle = atan(dir.z, dir.x + 1e-6);
          float curtain = texture2D(uNoise, vec2(angle * 0.5 + uTime * 0.01, uTime * 0.02)).r;
          float height = smoothstep(0.05, 0.25, up) * (1.0 - smoothstep(0.35 + curtain * 0.35, 0.75, up));
          float rays = texture2D(uNoise, vec2(angle * 3.0 + curtain, up * 0.3 - uTime * 0.03)).g;
          vec3 hue = mix(vec3(0.2, 1.0, 0.6), vec3(0.4, 0.6, 1.0), smoothstep(0.2, 0.6, up));
          hue = mix(hue, vec3(0.8, 0.3, 1.0), smoothstep(0.5, 0.8, up + curtain * 0.2));
          color += hue * height * smoothstep(0.35, 0.8, rays) * uAurora * 1.3;
        }

        // A planet with a ring, lit from the side.
        if (uPlanetSize > 0.0) {
          float d = acos(clamp(dot(dir, uPlanetDir), -1.0, 1.0));
          float disc = (1.0 - smoothstep(uPlanetSize * 0.97, uPlanetSize, d));
          vec3 side = normalize(cross(uPlanetDir, vec3(0.0, 1.0, 0.0)));
          float lit = 0.35 + 0.65 * smoothstep(-0.2, 0.15, dot(dir - uPlanetDir, side));
          float stripes = texture2D(uNoise, vec2(dot(dir, vec3(0.0, 1.0, 0.0)) * 8.0, 0.2)).r;
          vec3 planet = uPlanetColor * (0.6 + stripes * 0.5) * lit;
          color = mix(color, planet, disc);
          vec3 tilt = normalize(vec3(0.15, 1.0, 0.25));
          float ringPlane = abs(dot(dir - uPlanetDir, tilt));
          float ring = (1.0 - smoothstep(0.0, 0.012, ringPlane)) * smoothstep(uPlanetSize * 1.25, uPlanetSize * 1.4, d) * (1.0 - smoothstep(uPlanetSize * 1.9, uPlanetSize * 2.3, d));
          color += uPlanetColor * ring * 0.7 * (1.0 - disc * step(0.0, dot(dir - uPlanetDir, tilt)));
          color += uPlanetColor * exp(-pow((d - uPlanetSize) * 40.0, 2.0)) * 0.3;
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), material)
  mesh.frustumCulled = false
  mesh.renderOrder = -100
  return mesh
}

export function updateSky(sky: THREE.Mesh, time: number): void {
  uniform((sky.material as THREE.ShaderMaterial).uniforms, 'uTime').value = time
}
