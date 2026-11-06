import { type Random, seededRandom } from './random'

/** A smooth noise field: values in about [-1, 1] that change gently from point to point. */
export type Noise2 = (x: number, y: number) => number

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6
const GRADIENTS = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

/** 2D simplex noise with its own shuffled table, so each seed gives its own landscape. */
export function simplex2(seed: number | Random): Noise2 {
  const random = typeof seed === 'number' ? seededRandom(seed) : seed
  const table = new Uint8Array(256)
  for (let index = 0; index < 256; index++) table[index] = index
  for (let index = 255; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    const swap = table[index] as number
    table[index] = table[other] as number
    table[other] = swap
  }
  const perm = new Uint8Array(512)
  for (let index = 0; index < 512; index++) perm[index] = table[index & 255] as number

  const corner = (gi: number, x: number, y: number) => {
    const t = 0.5 - x * x - y * y
    if (t < 0) return 0
    const gradient = GRADIENTS[gi & 7] as readonly [number, number]
    return t * t * t * t * (gradient[0] * x + gradient[1] * y)
  }

  return (x, y) => {
    const skew = (x + y) * F2
    const i = Math.floor(x + skew)
    const j = Math.floor(y + skew)
    const unskew = (i + j) * G2
    const x0 = x - (i - unskew)
    const y0 = y - (j - unskew)
    const i1 = x0 > y0 ? 1 : 0
    const j1 = x0 > y0 ? 0 : 1
    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2
    const ii = i & 255
    const jj = j & 255
    const g0 = perm[ii + (perm[jj] as number)] as number
    const g1 = perm[ii + i1 + (perm[jj + j1] as number)] as number
    const g2 = perm[ii + 1 + (perm[jj + 1] as number)] as number
    return 70 * (corner(g0, x0, y0) + corner(g1, x1, y1) + corner(g2, x2, y2))
  }
}

/** Layers of noise, each finer and fainter: rolling ground with detail. */
export function fbm(noise: Noise2, x: number, y: number, octaves = 4): number {
  let sum = 0
  let amplitude = 0.5
  let frequency = 1
  let norm = 0
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * noise(x * frequency, y * frequency)
    norm += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return sum / norm
}

/** Sharp crests where the noise crosses zero, in [0, 1]: ridges, canyons and dunes. */
export function ridged(noise: Noise2, x: number, y: number, octaves = 3): number {
  let sum = 0
  let amplitude = 0.5
  let frequency = 1
  let norm = 0
  for (let octave = 0; octave < octaves; octave++) {
    const value = 1 - Math.abs(noise(x * frequency, y * frequency))
    sum += amplitude * value * value
    norm += amplitude
    amplitude *= 0.5
    frequency *= 2.1
  }
  return sum / norm
}
