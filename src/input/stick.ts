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
 * The shape of a stick's dead zone. Round ignores small leans in every direction alike; cross
 * ignores each axis on its own, so a lean that is nearly straight comes out straight; square
 * ignores a lean only while both axes are small, so the slightest push along one axis counts.
 */
export const DEAD_ZONE_SHAPES = ['round', 'cross', 'square'] as const
export type DeadZoneShape = (typeof DEAD_ZONE_SHAPES)[number]

/** How a player tuned a stick: its dead zone, the shape of it, and how strongly it answers. */
export interface StickTuning {
  /** The share of the stick's travel that counts as resting, 0 to 0.5. */
  readonly deadZone: number
  readonly shape: DeadZoneShape
  /** How strongly the stick answers: 1 as made, 2 twice as much. */
  readonly sensitivity: number
}

/** Takes a dead zone off a value from 0 to 1 and stretches the rest back to 0 to 1. */
function beyond(value: number, deadZone: number): number {
  return Math.max(0, Math.min(1, (value - deadZone) / (1 - deadZone)))
}

/**
 * A stick reading without its dead zone: small leans count as none, and the rest is stretched so
 * that the stick still reaches full lean at its edge. `curve` above 1 gives finer control near
 * the middle.
 */
export function shapeStick(
  x: number,
  y: number,
  deadZone = 0.15,
  curve = 1.3,
  shape: DeadZoneShape = 'round',
): Vec2 {
  let dx = x
  let dy = y
  if (shape === 'cross') {
    dx = Math.sign(x) * beyond(Math.abs(x), deadZone)
    dy = Math.sign(y) * beyond(Math.abs(y), deadZone)
  } else {
    // Round measures the lean by its length, square by its larger axis.
    const size = shape === 'round' ? Math.hypot(x, y) : Math.max(Math.abs(x), Math.abs(y))
    if (size <= deadZone) return ZERO
    const scale = beyond(size, deadZone) / size
    dx = x * scale
    dy = y * scale
  }
  const length = Math.hypot(dx, dy)
  if (length === 0) return ZERO
  const lean = Math.min(1, length) ** curve
  return { x: (dx / length) * lean, y: (dy / length) * lean }
}

/**
 * A stick as a player tuned it. A stick that steers stops at full lean, sooner the more sensitive
 * it is; one that turns the camera turns faster.
 */
export function tuneStick(raw: Vec2, tuning: StickTuning, curve: number, clamp: boolean): Vec2 {
  const shaped = shapeStick(raw.x, raw.y, tuning.deadZone, curve, tuning.shape)
  const x = shaped.x * tuning.sensitivity
  const y = shaped.y * tuning.sensitivity
  return clamp ? clampUnit(x, y) : { x, y }
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
