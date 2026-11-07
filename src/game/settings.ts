import { signal } from '@preact/signals-core'
import {
  type Bindings,
  DEFAULT_BINDINGS,
  DEFAULT_STICKS,
  type StickSettings,
} from '../input/bindings'

export const QUALITIES = ['auto', 'low', 'medium', 'high', 'ultra'] as const
export type Quality = (typeof QUALITIES)[number]

/** Whether the ship is see-through in rides: automatic is at high and ultra quality only. */
export const SEE_THROUGH = ['auto', 'on', 'off'] as const
export type SeeThrough = (typeof SEE_THROUGH)[number]

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
  /** Up and down swapped for the camera. */
  readonly invertLookY: boolean
  /** The mouse pointer steers the ship. */
  readonly mouseSteer: boolean
  /** How fast the camera turns, 0.4 to 2. */
  readonly lookSpeed: number
  /** The controller's sticks: dead zones, how strongly they answer, and which steers. */
  readonly sticks: StickSettings
  /** Which keys and controller buttons do what. */
  readonly bindings: Bindings
  /** The ship and the girl see-through in rides, so the way ahead shows. */
  readonly seeThrough: SeeThrough
  /** How large the HUD draws, 0.2 to 4 times. */
  readonly hudScale: number
  /** How large dialogs and the treasure card draw, 0.5 to 2 times. */
  readonly menuScale: number
  /** Less camera shake, no speed blur and gentler flashes. */
  readonly reducedMotion: boolean
  readonly vibration: boolean
  readonly showFps: boolean
  /** Draws the circles the ride's rules test, for debugging. */
  readonly showHitboxes: boolean
  /** The Android app looks for a newer build at every start: off unless the player says yes. */
  readonly checkUpdates: boolean
  /** Whether the app asked the player about looking for updates yet. */
  readonly updatesAsked: boolean
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
  invertLookY: false,
  mouseSteer: true,
  lookSpeed: 1,
  sticks: DEFAULT_STICKS,
  bindings: DEFAULT_BINDINGS,
  seeThrough: 'auto',
  hudScale: 1,
  menuScale: 1,
  reducedMotion: prefersLessMotion(),
  vibration: true,
  showFps: false,
  showHitboxes: false,
  checkUpdates: false,
  updatesAsked: false,
}

/** The settings in force. The save sets them when it loads, and the settings dialog changes them. */
export const settings = signal<Settings>(DEFAULT_SETTINGS)
