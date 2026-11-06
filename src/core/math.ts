/** Small numeric helpers shared by the rules and the view. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

/** Hermite step from 0 at `edge0` to 1 at `edge1`. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp01((value - edge0) / (edge1 - edge0))
  return x * x * (3 - 2 * x)
}

/**
 * The share of the way to a target that a value covers in `dt` seconds when it closes on the
 * target at `rate` per second: frame-rate independent smoothing.
 */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt)
}

/** Moves `from` toward `to` by the damped share, as `damp` describes. */
export function approach(from: number, to: number, rate: number, dt: number): number {
  return lerp(from, to, damp(rate, dt))
}

/** The shortest signed difference between two angles in radians, in [-π, π]. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

/** Length of a 2D vector. */
export function length2(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}
