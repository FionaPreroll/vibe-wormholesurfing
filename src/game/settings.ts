import { signal } from '@preact/signals-core'

export const QUALITIES = ['auto', 'low', 'medium', 'high', 'ultra'] as const
export type Quality = (typeof QUALITIES)[number]

/** What players can change, kept with their save. */
export interface Settings {
  /** Volumes from 0 to 1. */
  readonly sound: number
  readonly music: number
  readonly quality: Quality
  /** Steering by tilting the device. */
  readonly gyro: boolean
  /** The tilt in degrees that steers fully. */
  readonly gyroRange: number
  /** Up and down swapped while flying. */
  readonly invertY: boolean
  /** The mouse pointer steers the ship. */
  readonly mouseSteer: boolean
  /** How fast the camera turns, 0.4 to 2. */
  readonly lookSpeed: number
  /** Less camera shake, no speed blur and gentler flashes. */
  readonly reducedMotion: boolean
  readonly vibration: boolean
  readonly showFps: boolean
}

function prefersLessMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const DEFAULT_SETTINGS: Settings = {
  sound: 0.8,
  music: 0.55,
  quality: 'auto',
  gyro: false,
  gyroRange: 24,
  invertY: false,
  mouseSteer: true,
  lookSpeed: 1,
  reducedMotion: prefersLessMotion(),
  vibration: true,
  showFps: false,
}

/** The settings in force. The save sets them when it loads, and the settings dialog changes them. */
export const settings = signal<Settings>(DEFAULT_SETTINGS)
