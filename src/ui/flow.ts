import { signal } from '@preact/signals'
import type { Arrival, Found } from '../game/hud'

export type Screen = 'title' | 'ride' | 'world' | 'collection' | 'about'
export type Overlay = 'settings' | 'help' | undefined

/** Which part of the game shows. */
export const screen = signal<Screen>('title')
/** The game stands still under the pause menu. */
export const paused = signal(false)
/** A dialog over everything else. */
export const overlay = signal<Overlay>(undefined)
/** Where the last ride led. */
export const arrival = signal<Arrival | undefined>(undefined)
/** What the last treasure held, once revealed. */
export const found = signal<Found | undefined>(undefined)
/** The 3D view could not start. */
export const graphicsFailed = signal(false)
/** The 3D view is loading. */
export const loading = signal(true)
