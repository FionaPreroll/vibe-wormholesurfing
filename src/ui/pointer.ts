import { signal } from '@preact/signals'

const coarse = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : undefined

/**
 * Whether the device's main pointer is a finger, so that hints speak of taps instead of clicks.
 * It follows the device, as when a tablet is docked to a keyboard and mouse.
 */
export const touchScreen = signal(coarse?.matches ?? false)
coarse?.addEventListener('change', (event) => {
  touchScreen.value = event.matches
})
