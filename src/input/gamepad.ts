import { shapeStick, type Vec2, ZERO } from './stick'

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

export interface PadFrame {
  readonly connected: boolean
  readonly move: Vec2
  readonly look: Vec2
  /** Buttons down now, and those that went down since the last frame. */
  readonly held: ReadonlySet<number>
  readonly pressed: ReadonlySet<number>
  /** Whether a stick leaned or a button was down. */
  readonly active: boolean
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

/** Reads every connected controller once per frame, the left stick and D-pad as one. */
export class Pads {
  #before = new Set<number>()

  poll(): PadFrame {
    const pads = readPads().filter((pad): pad is Gamepad => pad?.connected === true)
    const held = new Set<number>()
    let moveX = 0
    let moveY = 0
    let lookX = 0
    let lookY = 0
    for (const pad of pads) {
      pad.buttons.forEach((button, index) => {
        if (button.pressed || button.value > 0.5) held.add(index)
      })
      const move = shapeStick(pad.axes[0] ?? 0, -(pad.axes[1] ?? 0))
      const look = shapeStick(pad.axes[2] ?? 0, -(pad.axes[3] ?? 0), 0.18, 1.6)
      moveX += move.x
      moveY += move.y
      lookX += look.x
      lookY += look.y
    }
    if (held.has(PAD.left)) moveX -= 1
    if (held.has(PAD.right)) moveX += 1
    if (held.has(PAD.up)) moveY += 1
    if (held.has(PAD.down)) moveY -= 1
    const length = Math.hypot(moveX, moveY)
    const move = length > 1 ? { x: moveX / length, y: moveY / length } : { x: moveX, y: moveY }
    const pressed = new Set([...held].filter((button) => !this.#before.has(button)))
    this.#before = held
    return {
      connected: pads.length > 0,
      move,
      look: pads.length > 0 ? { x: lookX, y: lookY } : ZERO,
      held,
      pressed,
      active: held.size > 0 || length > 0 || lookX !== 0 || lookY !== 0,
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
