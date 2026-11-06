import * as THREE from 'three'

/** The distance ahead at which the tunnel's bend reaches its full offset. */
export const BEND_DEPTH = 400

/**
 * The tunnel bends for the eye only: things ahead are pushed aside by an offset that grows with
 * the square of their distance, so the way ahead curves while the ship's own surroundings stay
 * straight. The same formula runs in the shaders.
 */
export function bendAt(
  depth: number,
  bend: THREE.Vector2,
  out = new THREE.Vector2(),
): THREE.Vector2 {
  const f = Math.max(0, depth) / BEND_DEPTH
  return out.set(bend.x * f * f, bend.y * f * f)
}

/** The bend as the ride goes on: slow sweeps left and right, up and down. */
export function bendFor(travel: number, out = new THREE.Vector2()): THREE.Vector2 {
  return out.set(
    Math.sin(travel * 0.0011) * 55 + Math.sin(travel * 0.00031 + 1.3) * 30,
    Math.cos(travel * 0.0008) * 32 + Math.sin(travel * 0.00047) * 14,
  )
}

/** GLSL for the same bend; needs `uniform vec2 uBend`. */
export const BEND_GLSL = /* glsl */ `
uniform vec2 uBend;
vec2 bendAt(float depth) {
  float f = max(depth, 0.0) / ${BEND_DEPTH.toFixed(1)};
  return uBend * f * f;
}
`
