import { describe, expect, it } from 'vitest'
import { fromAxisAngle, multiply, rotate, screenQuaternion, tiltSteer } from './gyroMath'

/** A phone held upright in portrait, screen facing the player. */
const UPRIGHT = { alpha: 0, beta: 90, gamma: 0 }

describe('screenQuaternion', () => {
  it('looks out of the back of an upright phone', () => {
    const q = screenQuaternion(UPRIGHT.alpha, UPRIGHT.beta, UPRIGHT.gamma, 0)
    const [x, y, z] = rotate(q, [0, 0, -1])
    // Looking horizontally, along the world's -z, with the screen's up pointing up.
    expect(y).toBeCloseTo(0)
    expect(Math.hypot(x, z)).toBeCloseTo(1)
    expect(rotate(q, [0, 1, 0])[1]).toBeCloseTo(1)
  })
})

describe('tiltSteer', () => {
  const calibration = screenQuaternion(0, 90, 0, 0)

  it('is straight ahead in the calibrated position', () => {
    const steer = tiltSteer(calibration, calibration, 25)
    expect(steer.x).toBe(0)
    expect(steer.y).toBe(0)
  })

  it('steers up when the screen is tipped to look up', () => {
    const steer = tiltSteer(calibration, screenQuaternion(0, 105, 0, 0), 25)
    expect(steer.y).toBeGreaterThan(0.4)
    expect(Math.abs(steer.x)).toBeLessThan(0.05)
  })

  it('steers right when the screen turns right like a window', () => {
    // alpha grows counterclockwise seen from above, so turning right lowers it.
    const steer = tiltSteer(calibration, screenQuaternion(-15, 90, 0, 0), 25)
    expect(steer.x).toBeGreaterThan(0.4)
    expect(Math.abs(steer.y)).toBeLessThan(0.05)
  })

  it('steers right when the screen turns clockwise like a wheel, also in landscape', () => {
    for (const angle of [0, 90, -90]) {
      const base = screenQuaternion(0, 90, 0, angle)
      // Clockwise, as the player sees it, is a negative turn about the axis toward the player.
      const turned = multiply(base, fromAxisAngle(0, 0, 1, (-15 * Math.PI) / 180))
      const steer = tiltSteer(base, turned, 25)
      expect(steer.x).toBeGreaterThan(0.4)
      expect(Math.abs(steer.y)).toBeLessThan(0.05)
    }
  })

  it('reaches full lean at the range and no farther', () => {
    const steer = tiltSteer(calibration, screenQuaternion(0, 150, 0, 0), 25)
    expect(Math.hypot(steer.x, steer.y)).toBeCloseTo(1)
  })
})
