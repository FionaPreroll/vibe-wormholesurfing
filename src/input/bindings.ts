import { PAD } from './gamepad'
import type { StickTuning } from './stick'

/** Everything a key or a controller button can do in the game. */
export const ACTIONS = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'lookUp',
  'lookDown',
  'lookLeft',
  'lookRight',
  'confirm',
  'interact',
  'pause',
  'recenter',
  'zoomIn',
  'zoomOut',
] as const
export type Action = (typeof ACTIONS)[number]

/** How many keys and how many controller buttons each action can have. */
export const KEY_SLOTS = 2
export const PAD_SLOTS = 2

/**
 * Which keys (by `KeyboardEvent.code`, where they sit on the keyboard) and which buttons of the
 * standard controller layout do what. A key bound to steering and to the camera both, as the
 * arrow keys are, steers while flying and turns the camera on foot.
 */
export interface Bindings {
  readonly keys: Readonly<Record<Action, readonly string[]>>
  readonly pad: Readonly<Record<Action, readonly number[]>>
}

export const DEFAULT_BINDINGS: Bindings = {
  keys: {
    moveUp: ['KeyW', 'ArrowUp'],
    moveDown: ['KeyS', 'ArrowDown'],
    moveLeft: ['KeyA', 'ArrowLeft'],
    moveRight: ['KeyD', 'ArrowRight'],
    lookUp: ['KeyI', 'ArrowUp'],
    lookDown: ['KeyK', 'ArrowDown'],
    lookLeft: ['KeyJ', 'ArrowLeft'],
    lookRight: ['KeyL', 'ArrowRight'],
    confirm: ['Space'],
    interact: ['KeyE', 'Enter'],
    pause: ['Escape', 'KeyP'],
    recenter: ['KeyC'],
    zoomIn: ['Equal', 'NumpadAdd'],
    zoomOut: ['Minus', 'NumpadSubtract'],
  },
  pad: {
    moveUp: [PAD.up],
    moveDown: [PAD.down],
    moveLeft: [PAD.left],
    moveRight: [PAD.right],
    lookUp: [],
    lookDown: [],
    lookLeft: [],
    lookRight: [],
    confirm: [PAD.a],
    interact: [PAD.x],
    pause: [PAD.start],
    recenter: [PAD.y],
    zoomIn: [PAD.lb],
    zoomOut: [PAD.rb],
  },
}

/** How the two sticks are tuned, and which of them steers. */
export interface StickSettings {
  readonly move: StickTuning
  readonly look: StickTuning
  /** The right stick steers and walks, and the left one turns the camera. */
  readonly swap: boolean
}

export const DEFAULT_STICKS: StickSettings = {
  move: { deadZone: 0.15, shape: 'round', sensitivity: 1 },
  look: { deadZone: 0.18, shape: 'round', sensitivity: 1 },
  swap: false,
}

const isMove = (action: Action) => action.startsWith('move')
const isLook = (action: Action) => action.startsWith('look')

/**
 * Whether two actions may share a key or a button: only a way to steer and the camera's turn the
 * same way, as the arrow keys have.
 */
function mayShare(one: Action, other: Action): boolean {
  return (
    (isMove(one) && isLook(other) && one.slice(4) === other.slice(4)) ||
    (isLook(one) && isMove(other) && one.slice(4) === other.slice(4))
  )
}

type Device = 'keys' | 'pad'

/**
 * Puts a key or a button in one slot of an action, in place of what the slot held. Another action
 * that had it loses it, so one press never does two things, except for the pairs that may share.
 */
export function bind<D extends Device>(
  bindings: Bindings,
  device: D,
  action: Action,
  slot: number,
  input: Bindings[D][Action][number],
): Bindings {
  const table = bindings[device] as Readonly<Record<Action, readonly (string | number)[]>>
  const next = {} as Record<Action, (string | number)[]>
  for (const other of ACTIONS) {
    const current = [...table[other]]
    next[other] =
      other === action || mayShare(action, other)
        ? current
        : current.filter((value) => value !== input)
  }
  // The slot takes the new one in place of what it held; past the last, it goes at the end.
  const own = [...next[action]]
  const at = Math.min(slot, own.length)
  own[at] = input
  next[action] = own
    .filter((value, index) => value !== input || index === at)
    .slice(0, device === 'keys' ? KEY_SLOTS : PAD_SLOTS)
  return { ...bindings, [device]: next }
}

/** Empties one slot of an action. */
export function unbind(bindings: Bindings, device: Device, action: Action, slot: number): Bindings {
  const table = bindings[device] as Readonly<Record<Action, readonly (string | number)[]>>
  return {
    ...bindings,
    [device]: { ...table, [action]: table[action].filter((_, index) => index !== slot) },
  }
}

/** The actions a key does in a mode: the camera's on foot where a key does both. */
export function actionsForKey(
  bindings: Bindings,
  code: string,
  mode: 'ride' | 'world' | 'menu',
): Action[] {
  const actions = ACTIONS.filter((action) => bindings.keys[action].includes(code))
  return actions.filter((action) => {
    const pair = isMove(action) ? `look${action.slice(4)}` : `move${action.slice(4)}`
    if (!(isMove(action) || isLook(action)) || !actions.includes(pair as Action)) return true
    return mode === 'world' ? isLook(action) : isMove(action)
  })
}

/** Every key that does something, so the page does not scroll with it. */
export function boundKeys(bindings: Bindings): ReadonlySet<string> {
  return new Set(ACTIONS.flatMap((action) => bindings.keys[action]))
}
