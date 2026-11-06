import { clampUnit, shapeStick, type Vec2 } from './stick'

/** Buttons of the standard gamepad layout. */
export const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  back: 8,
  start: 9,
  ls: 10,
  rs: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const

/**
 * Which buttons a controller has printed on it: letters as on Xbox controllers, symbols as on
 * PlayStation ones, or letters swapped about as on Nintendo ones. The standard layout numbers
 * buttons by where they sit, so the bottom face button is button 0 on all of them.
 */
export type PadStyle = 'xbox' | 'playstation' | 'nintendo'

/** Tells a controller's make from the name and the USB vendor the browser gives it. */
export function padStyle(id: string): PadStyle {
  if (/054c|playstation|dualshock|dualsense|^wireless controller/i.test(id)) return 'playstation'
  if (/057e|nintendo|pro controller|joy-con/i.test(id)) return 'nintendo'
  return 'xbox'
}

export interface PadFrame {
  readonly connected: boolean
  /** The left stick and the D-pad as one, as the menus take them. */
  readonly move: Vec2
  /** The D-pad alone, for menus where the sticks are being tried out. */
  readonly dpad: Vec2
  /** The right stick, as the menus take it for scrolling. */
  readonly look: Vec2
  /** Both sticks as they lean, before any dead zone: right and up positive. */
  readonly left: Vec2
  readonly right: Vec2
  /** Buttons down now, and those that went down since the last frame. */
  readonly held: ReadonlySet<number>
  readonly pressed: ReadonlySet<number>
  /** Whether a stick leaned or a button was down. */
  readonly active: boolean
  /** The make of the first controller, for the names of its buttons. */
  readonly style: PadStyle
}

function readPads(): readonly (Gamepad | null)[] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return []
  try {
    return [...navigator.getGamepads()]
  } catch {
    // Browsers can refuse the Gamepad API, for example in frames without permission.
    return []
  }
}

/** A stick that leans less than this counts as resting when telling whether a pad is in use. */
const RESTING = 0.2

/** Reads every connected controller once per frame, the left stick and D-pad as one. */
export class Pads {
  #before = new Set<number>()

  poll(): PadFrame {
    const pads = readPads().filter((pad): pad is Gamepad => pad?.connected === true)
    const held = new Set<number>()
    let leftX = 0
    let leftY = 0
    let rightX = 0
    let rightY = 0
    for (const pad of pads) {
      pad.buttons.forEach((button, index) => {
        if (button.pressed || button.value > 0.5) held.add(index)
      })
      leftX += pad.axes[0] ?? 0
      leftY -= pad.axes[1] ?? 0
      rightX += pad.axes[2] ?? 0
      rightY -= pad.axes[3] ?? 0
    }
    const left = clampUnit(leftX, leftY)
    const right = clampUnit(rightX, rightY)
    const stick = shapeStick(left.x, left.y)
    const dpad = {
      x: (held.has(PAD.right) ? 1 : 0) - (held.has(PAD.left) ? 1 : 0),
      y: (held.has(PAD.up) ? 1 : 0) - (held.has(PAD.down) ? 1 : 0),
    }
    const moveX = stick.x + dpad.x
    const moveY = stick.y + dpad.y
    const pressed = new Set([...held].filter((button) => !this.#before.has(button)))
    this.#before = held
    return {
      connected: pads.length > 0,
      move: clampUnit(moveX, moveY),
      dpad,
      look: shapeStick(right.x, right.y, 0.18, 1.6),
      left,
      right,
      held,
      pressed,
      active:
        held.size > 0 ||
        Math.hypot(left.x, left.y) > RESTING ||
        Math.hypot(right.x, right.y) > RESTING,
      style: padStyle(pads[0]?.id ?? ''),
    }
  }
}

/** A short rumble on every controller that can. */
export function rumblePads(strength: number, ms: number): void {
  for (const pad of readPads()) {
    const actuator = (pad as (Gamepad & { vibrationActuator?: GamepadHapticActuator }) | null)
      ?.vibrationActuator
    actuator
      ?.playEffect('dual-rumble', {
        duration: ms,
        strongMagnitude: Math.min(1, strength),
        weakMagnitude: Math.min(1, strength * 0.6),
      })
      .catch(() => {})
  }
}
