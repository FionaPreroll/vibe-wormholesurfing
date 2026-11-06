import { rumblePads } from './gamepad'

/** Whether buzzes are wanted; the settings switch it. */
export const haptics = { enabled: true }

/** A buzz on the phone and on controllers, if they can and the player wants it. */
export function buzz(strength: number, ms: number): void {
  if (!haptics.enabled) return
  rumblePads(strength, ms)
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(Math.round(ms * Math.min(1, strength + 0.3)))
    } catch {
      // Some browsers refuse vibration without a recent tap.
    }
  }
}
