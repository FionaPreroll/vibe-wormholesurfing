import { shapeStick, type Vec2 } from './stick'

/** A rotation as a unit quaternion: x, y, z and w. */
export type Quat = readonly [number, number, number, number]

const DEG = Math.PI / 180

export function multiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    ax * bw + aw * bx + ay * bz - az * by,
    ay * bw + aw * by + az * bx - ax * bz,
    az * bw + aw * bz + ax * by - ay * bx,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

export function conjugate([x, y, z, w]: Quat): Quat {
  return [-x, -y, -z, w]
}

/** Turns a vector by a rotation. */
export function rotate(q: Quat, [vx, vy, vz]: readonly [number, number, number]) {
  const [x, y, z, w] = q
  // v' = v + 2w(q×v) + 2q×(q×v)
  const cx = y * vz - z * vy
  const cy = z * vx - x * vz
  const cz = x * vy - y * vx
  return [
    vx + 2 * (w * cx + y * cz - z * cy),
    vy + 2 * (w * cy + z * cx - x * cz),
    vz + 2 * (w * cz + x * cy - y * cx),
  ] as const
}

export function fromAxisAngle(ax: number, ay: number, az: number, angle: number): Quat {
  const s = Math.sin(angle / 2)
  return [ax * s, ay * s, az * s, Math.cos(angle / 2)]
}

/** Euler angles in the order Y, X, Z, as three.js composes them. */
function fromEulerYXZ(x: number, y: number, z: number): Quat {
  const c1 = Math.cos(x / 2)
  const c2 = Math.cos(y / 2)
  const c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2)
  const s2 = Math.sin(y / 2)
  const s3 = Math.sin(z / 2)
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 - s1 * s2 * c3,
    c1 * c2 * c3 + s1 * s2 * s3,
  ]
}

const LOOK_OUT_OF_BACK = fromAxisAngle(1, 0, 0, -Math.PI / 2)

/**
 * The orientation of the screen from a deviceorientation event, in degrees, and the angle the
 * screen is turned by: a frame whose x points right on the screen, y up the screen and -z out of
 * the back of the device, the way the player looks through it.
 */
export function screenQuaternion(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle: number,
): Quat {
  const device = fromEulerYXZ(beta * DEG, alpha * DEG, -gamma * DEG)
  const camera = multiply(device, LOOK_OUT_OF_BACK)
  return multiply(camera, fromAxisAngle(0, 0, 1, -screenAngle * DEG))
}

/**
 * Steering from how the screen has turned since it was calibrated. Turning it like a steering
 * wheel or like a window to look through both steer sideways; tipping it to look up or down
 * steers up or down. `range` is the angle in degrees that gives full lean.
 */
export function tiltSteer(calibration: Quat, current: Quat, range: number): Vec2 {
  const relative = multiply(conjugate(calibration), current)
  const [lookX, lookY] = rotate(relative, [0, 0, -1])
  const [upX] = rotate(relative, [0, 1, 0])
  const full = Math.sin(Math.min(80, Math.max(5, range)) * DEG)
  return shapeStick((lookX + upX) / full, lookY / full, 0.05, 1.15)
}
