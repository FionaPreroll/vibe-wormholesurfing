import type { Quality } from '../game/settings'

/** How much a level of quality may spend. */
export interface QualityLevel {
  readonly name: Exclude<Quality, 'auto'>
  /** Highest pixel ratio drawn; the engine goes lower while frames run late. */
  readonly maxPixelRatio: number
  /** Multisampling of the scene, 0 for none. */
  readonly samples: number
  readonly shadows: number
  /** Share of particles, crystals and grass. */
  readonly detail: number
  readonly radialBlur: boolean
}

export const LEVELS: Readonly<Record<Exclude<Quality, 'auto'>, QualityLevel>> = {
  low: { name: 'low', maxPixelRatio: 1, samples: 0, shadows: 0, detail: 0.45, radialBlur: false },
  medium: {
    name: 'medium',
    maxPixelRatio: 1.5,
    samples: 0,
    shadows: 1024,
    detail: 0.7,
    radialBlur: false,
  },
  high: { name: 'high', maxPixelRatio: 2, samples: 4, shadows: 2048, detail: 1, radialBlur: true },
  ultra: {
    name: 'ultra',
    maxPixelRatio: 3,
    samples: 4,
    shadows: 4096,
    detail: 1.35,
    radialBlur: true,
  },
}

/** Whether the device is a phone or tablet, by its pointer and screen. */
function handheld(): boolean {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  return coarse || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
}

/**
 * The level that `auto` picks: high on computers and good phones, and the lowest where WebGL
 * runs in software, as in headless test browsers.
 */
export function autoLevel(software: boolean): QualityLevel {
  if (software) return LEVELS.low
  if (handheld()) return LEVELS.medium
  return LEVELS.high
}

export function levelOf(quality: Quality, software: boolean): QualityLevel {
  return quality === 'auto' ? autoLevel(software) : LEVELS[quality]
}
