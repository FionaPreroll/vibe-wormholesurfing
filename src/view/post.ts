import * as THREE from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { HASH } from './glsl'

/** How a scene wants the picture finished, changed by the scene as it plays. */
export interface Look {
  bloom: number
  bloomRadius: number
  bloomThreshold: number
  exposure: number
  /** Color fringes toward the edges, as at high speed. */
  aberration: number
  /** Blur streaking out from the middle, for speed. */
  radialBlur: number
  vignette: number
  grain: number
  /** A flash over everything, 0 to 1, in `flashColor`. */
  flash: number
  readonly flashColor: THREE.Color
  /** Saturation, 1 as is. */
  saturation: number
}

export function defaultLook(): Look {
  return {
    bloom: 0.9,
    bloomRadius: 0.55,
    bloomThreshold: 0.72,
    exposure: 1,
    aberration: 0,
    radialBlur: 0,
    vignette: 0.35,
    grain: 0.035,
    flash: 0,
    flashColor: new THREE.Color(1, 1, 1),
    saturation: 1.05,
  }
}

/** The last touch before tone mapping: fringes, speed blur, vignette, flash and film grain. */
export function finishPass(radialBlur: boolean): ShaderPass {
  return new ShaderPass({
    name: 'FinishShader',
    defines: { BLUR_SAMPLES: radialBlur ? 8 : 0 },
    uniforms: {
      tDiffuse: { value: null },
      uAberration: { value: 0 },
      uBlur: { value: 0 },
      uVignette: { value: 0.35 },
      uGrain: { value: 0.03 },
      uFlash: { value: 0 },
      uFlashColor: { value: new THREE.Color(1, 1, 1) },
      uSaturation: { value: 1 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uAberration;
      uniform float uBlur;
      uniform float uVignette;
      uniform float uGrain;
      uniform float uFlash;
      uniform vec3 uFlashColor;
      uniform float uSaturation;
      uniform float uTime;
      uniform float uAspect;
      varying vec2 vUv;
      ${HASH}
      void main() {
        vec2 center = vUv - 0.5;
        float edge = dot(center * vec2(uAspect, 1.0), center * vec2(uAspect, 1.0));
        vec2 shift = center * edge * uAberration;
        vec3 color;
        color.r = texture2D(tDiffuse, vUv + shift).r;
        color.g = texture2D(tDiffuse, vUv).g;
        color.b = texture2D(tDiffuse, vUv - shift).b;
        #if BLUR_SAMPLES > 0
        if (uBlur > 0.001) {
          vec3 sum = color;
          float weight = 1.0;
          for (int i = 1; i <= BLUR_SAMPLES; i++) {
            float t = float(i) / float(BLUR_SAMPLES);
            float w = 1.0 - t * 0.7;
            sum += texture2D(tDiffuse, vUv - center * uBlur * t * (0.4 + edge)).rgb * w;
            weight += w;
          }
          color = mix(color, sum / weight, clamp(edge * 4.0, 0.0, 1.0));
        }
        #endif
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, uSaturation);
        color *= 1.0 - uVignette * smoothstep(0.08, 0.75, edge * 1.6);
        color = mix(color, uFlashColor * 2.2, uFlash);
        float noise = hash12(vUv * 1024.0 + fract(uTime * 7.3) * 517.0) - 0.5;
        color += noise * uGrain * (0.4 + luma);
        gl_FragColor = vec4(max(color, 0.0), 1.0);
      }
    `,
  })
}
