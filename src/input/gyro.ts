import { signal } from '@preact/signals-core'
import { type Quat, screenQuaternion, tiltSteer } from './gyroMath'
import { type Vec2, ZERO } from './stick'

export type GyroState = 'off' | 'waiting' | 'on' | 'denied' | 'unsupported'

/** iOS asks for permission before it sends motion; other browsers send it at once. */
interface OrientationPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

function screenAngle(): number {
  const angle = screen.orientation?.angle
  if (typeof angle === 'number') return angle
  const legacy = (window as { orientation?: number }).orientation
  return typeof legacy === 'number' ? legacy : 0
}

export function gyroAvailable(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
}

/**
 * Steering by tilting the device. It steers relative to how the device was held when it was last
 * calibrated, which happens when it is switched on, when a ride starts, and on request.
 */
export class Gyro {
  readonly state = signal<GyroState>('off')
  /** The angle in degrees that gives full lean. */
  range = 24
  /** When the device was last tipped far enough to count as steering, in ms. */
  lastTilt = Number.NEGATIVE_INFINITY

  #current: Quat | undefined
  #calibration: Quat | undefined
  #value: Vec2 = ZERO
  #listening = false
  #timeout: ReturnType<typeof setTimeout> | undefined

  readonly #onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return
    this.#current = screenQuaternion(event.alpha ?? 0, event.beta, event.gamma, screenAngle())
    if (this.state.value === 'waiting') {
      this.state.value = 'on'
      clearTimeout(this.#timeout)
    }
    if (!this.#calibration) this.#calibration = this.#current
    this.#value = tiltSteer(this.#calibration, this.#current, this.range)
    if (Math.hypot(this.#value.x, this.#value.y) > 0.3) this.lastTilt = performance.now()
  }

  /** Switches tilting on; call it from a tap or click, as iOS asks. */
  async enable(): Promise<GyroState> {
    if (!gyroAvailable()) {
      this.state.value = 'unsupported'
      return this.state.value
    }
    const request = (DeviceOrientationEvent as unknown as OrientationPermission).requestPermission
    if (typeof request === 'function') {
      try {
        const answer = await request.call(DeviceOrientationEvent)
        if (answer !== 'granted') {
          this.state.value = 'denied'
          return this.state.value
        }
      } catch {
        this.state.value = 'denied'
        return this.state.value
      }
    }
    this.#calibration = undefined
    this.state.value = this.#current ? 'on' : 'waiting'
    if (!this.#listening) {
      window.addEventListener('deviceorientation', this.#onOrientation)
      this.#listening = true
    }
    // Desktops have the event but never send it.
    clearTimeout(this.#timeout)
    this.#timeout = setTimeout(() => {
      if (this.state.value === 'waiting') this.state.value = 'unsupported'
    }, 1500)
    return this.state.value
  }

  disable(): void {
    if (this.#listening) window.removeEventListener('deviceorientation', this.#onOrientation)
    this.#listening = false
    this.#value = ZERO
    this.#current = undefined
    clearTimeout(this.#timeout)
    if (this.state.value !== 'unsupported') this.state.value = 'off'
  }

  /** Takes the way the device is held now as straight ahead. */
  calibrate(): void {
    this.#calibration = this.#current
    this.#value = ZERO
  }

  get active(): boolean {
    return this.state.value === 'on'
  }

  read(): Vec2 {
    return this.active ? this.#value : ZERO
  }
}
