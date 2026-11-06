import * as THREE from 'three'

/**
 * A tiling texture of smooth noise, made once: shaders that cover the whole screen read it
 * instead of computing noise per pixel, which phones thank them for. Its channels hold noise of
 * rising fineness: red broad, green middle, blue fine, alpha ridged.
 */
export function makeNoiseTexture(size = 256, seed = 7): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4)
  const lattice = (period: number, salt: number) => {
    const values = new Float32Array(period * period)
    let state = (seed * 7919 + salt * 104729) >>> 0
    for (let index = 0; index < values.length; index++) {
      state = (state * 1664525 + 1013904223) >>> 0
      values[index] = state / 4294967296
    }
    return (x: number, y: number) => {
      const xi = Math.floor(x)
      const yi = Math.floor(y)
      const fx = x - xi
      const fy = y - yi
      const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
      const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
      const at = (i: number, j: number) =>
        values[(((j % period) + period) % period) * period + (((i % period) + period) % period)] ??
        0
      const a = at(xi, yi)
      const b = at(xi + 1, yi)
      const c = at(xi, yi + 1)
      const d = at(xi + 1, yi + 1)
      return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
    }
  }
  const octaves = (base: number, count: number, salt: number) => {
    const layers = Array.from({ length: count }, (_, index) => lattice(base << index, salt + index))
    return (u: number, v: number) => {
      let sum = 0
      let amplitude = 0.5
      let norm = 0
      layers.forEach((layer, index) => {
        const period = base << index
        sum += layer(u * period, v * period) * amplitude
        norm += amplitude
        amplitude *= 0.5
      })
      return sum / norm
    }
  }
  const broad = octaves(4, 4, 1)
  const middle = octaves(8, 4, 11)
  const fine = octaves(16, 3, 23)
  const ridge = octaves(6, 4, 37)
  // Layered value noise bunches up around one half; each channel is stretched to fill 0 to 1,
  // so that thresholds in the shaders mean the same on every channel.
  const fields = [broad, middle, fine, ridge].map((field) => {
    const values = new Float32Array(size * size)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) values[y * size + x] = field(x / size, y / size)
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const value of values) {
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
    for (let index = 0; index < values.length; index++)
      values[index] = ((values[index] as number) - min) / Math.max(1e-6, max - min)
    return values
  })
  const [r, g, b, ridged] = fields as [Float32Array, Float32Array, Float32Array, Float32Array]
  for (let index = 0; index < size * size; index++) {
    data[index * 4] = (r[index] as number) * 255
    data[index * 4 + 1] = (g[index] as number) * 255
    data[index * 4 + 2] = (b[index] as number) * 255
    // Thin crests where the noise crosses its middle: threads and filaments.
    const crest = Math.max(0, 1 - Math.abs((ridged[index] as number) * 2 - 1) * 3)
    data[index * 4 + 3] = crest * crest * 255
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

let shared: THREE.DataTexture | undefined

/** The one noise texture every shader shares. */
export function noiseTexture(): THREE.DataTexture {
  shared ??= makeNoiseTexture()
  return shared
}
