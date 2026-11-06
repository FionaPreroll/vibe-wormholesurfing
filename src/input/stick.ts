/** A 2D direction with a length of at most 1, right and up positive. */
export interface Vec2 {
  readonly x: number
  readonly y: number
}

export const ZERO: Vec2 = { x: 0, y: 0 }

/** Shortens a vector to length 1 when it is longer. */
export function clampUnit(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y)
  return length > 1 ? { x: x / length, y: y / length } : { x, y }
}

/**
 * A stick reading with a round dead zone: small leans count as none, and the rest is stretched
 * so that the stick still reaches full lean at its edge. `curve` above 1 gives finer control
 * near the middle.
 */
export function shapeStick(x: number, y: number, deadZone = 0.15, curve = 1.3): Vec2 {
  const length = Math.hypot(x, y)
  if (length <= deadZone) return ZERO
  const lean = Math.min(1, (length - deadZone) / (1 - deadZone)) ** curve
  return { x: (x / length) * lean, y: (y / length) * lean }
}

/** Arrow keys or WASD as a direction, diagonals no faster than straight lines. */
export function keysToVector(up: boolean, down: boolean, left: boolean, right: boolean): Vec2 {
  const x = (right ? 1 : 0) - (left ? 1 : 0)
  const y = (up ? 1 : 0) - (down ? 1 : 0)
  return clampUnit(x, y)
}

/**
 * A stick for a finger: it appears where the finger lands, and leaning the finger away from that
 * spot leans the stick, full at `radius` pixels. A finger that pulls farther drags the middle
 * along, so turning back answers at once.
 */
export class FloatingStick {
  originX: number
  originY: number
  x: number
  y: number

  constructor(
    x: number,
    y: number,
    readonly radius = 64,
  ) {
    this.originX = x
    this.originY = y
    this.x = x
    this.y = y
  }

  move(x: number, y: number): void {
    this.x = x
    this.y = y
    const dx = x - this.originX
    const dy = y - this.originY
    const length = Math.hypot(dx, dy)
    if (length > this.radius) {
      this.originX = x - (dx / length) * this.radius
      this.originY = y - (dy / length) * this.radius
    }
  }

  /** The lean, with screen y turned so that up is positive. */
  get value(): Vec2 {
    const lean = shapeStick(
      (this.x - this.originX) / this.radius,
      -(this.y - this.originY) / this.radius,
      0.08,
      1.1,
    )
    return lean
  }
}

/**
 * Steering by where the mouse points: the middle of the screen is straight ahead, and the edge of
 * a circle around it is full lean.
 */
export function pointerSteer(
  x: number,
  y: number,
  width: number,
  height: number,
  reach = 0.32,
): Vec2 {
  const radius = Math.max(1, Math.min(width, height) * reach)
  return shapeStick((x - width / 2) / radius, -(y - height / 2) / radius, 0.04, 1)
}
