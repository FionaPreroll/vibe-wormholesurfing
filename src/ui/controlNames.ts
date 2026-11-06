import { type MessageKey, t } from '../i18n'
import type { Action, Bindings } from '../input/bindings'
import { PAD, type PadStyle } from '../input/gamepad'

/** What the keyboard's own layout prints on its keys, where the browser says (Chrome does). */
let layout: ReadonlyMap<string, string> | undefined

interface KeyboardWithLayout {
  getLayoutMap?: () => Promise<ReadonlyMap<string, string>>
}

/** Asks the browser once for the keyboard's layout, so a German Z shows as Z and not as Y. */
export function learnKeyboardLayout(): void {
  const keyboard = (navigator as Navigator & { keyboard?: KeyboardWithLayout }).keyboard
  keyboard
    ?.getLayoutMap?.()
    .then((map) => {
      layout = map
    })
    .catch(() => {})
}

const NAMED: Readonly<Record<string, MessageKey>> = {
  Space: 'keySpace',
  Enter: 'keyEnter',
  Escape: 'keyEscape',
  Backspace: 'keyBackspace',
  Tab: 'keyTab',
  CapsLock: 'keyCapsLock',
  Delete: 'keyDelete',
  Insert: 'keyInsert',
  Home: 'keyHome',
  End: 'keyEnd',
  PageUp: 'keyPageUp',
  PageDown: 'keyPageDown',
}

const SIDED: Readonly<Record<string, MessageKey>> = {
  Shift: 'keyShift',
  Control: 'keyControl',
  Alt: 'keyAlt',
  Meta: 'keyMeta',
}

const ARROWS: Readonly<Record<string, string>> = { Up: '↑', Down: '↓', Left: '←', Right: '→' }

/** Signs on a US keyboard, where the browser does not tell the real layout. */
const SIGNS: Readonly<Record<string, string>> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '<',
  NumpadAdd: '+',
  NumpadSubtract: '-',
  NumpadMultiply: '*',
  NumpadDivide: '/',
  NumpadDecimal: ',',
}

/** The name of a key, by where it sits (`KeyboardEvent.code`), as printed on it. */
export function keyName(code: string): string {
  const named = NAMED[code]
  if (named) return t(named)
  const arrow = /^Arrow(Up|Down|Left|Right)$/.exec(code)
  if (arrow) return ARROWS[arrow[1] as string] as string
  const sided = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code)
  if (sided) {
    const key = t(SIDED[sided[1] as string] as MessageKey)
    return t(sided[2] === 'Left' ? 'keyLeftSide' : 'keyRightSide', { key })
  }
  const printed = layout?.get(code)
  if (code.startsWith('Numpad')) {
    const rest = code.slice('Numpad'.length)
    if (rest === 'Enter') return t('keyNumpad', { key: t('keyEnter') })
    return t('keyNumpad', { key: SIGNS[code] ?? rest })
  }
  if (printed && printed.trim() !== '') return printed.toUpperCase()
  const letter = /^Key([A-Z])$/.exec(code) ?? /^Digit(\d)$/.exec(code)
  if (letter) return letter[1] as string
  return SIGNS[code] ?? code
}

const FACES: Readonly<Record<PadStyle, readonly string[]>> = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'LS', 'RS'],
}

const DPAD: Readonly<Record<number, string>> = {
  [PAD.up]: '↑',
  [PAD.down]: '↓',
  [PAD.left]: '←',
  [PAD.right]: '→',
}

/** The name of a button of the standard layout, as the controller in use prints it. */
export function padButtonName(button: number, style: PadStyle): string {
  const face = FACES[style][button]
  if (face) return face
  const direction = DPAD[button]
  if (direction) return t('dpad', { direction })
  if (button === 16) return style === 'playstation' ? 'PS' : style === 'nintendo' ? 'Home' : 'Xbox'
  return t('padButton', { number: button })
}

/** A list of names, the last two joined with "or". */
function either(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return t('or', { one: names.slice(0, -1).join(', '), other: names[names.length - 1] as string })
}

/** The keys bound to an action, as "E or Enter". */
export function keysFor(bindings: Bindings, action: Action): string {
  return either(bindings.keys[action].map(keyName))
}

/** The buttons bound to an action, as "✕ or R2". */
export function buttonsFor(bindings: Bindings, action: Action, style: PadStyle): string {
  return either(bindings.pad[action].map((button) => padButtonName(button, style)))
}

/**
 * The four keys of a way to move, as players say them: "WASD", "the arrow keys", or the keys one
 * by one. Each slot of the four directions is one such set.
 */
export function directionKeys(bindings: Bindings, kind: 'move' | 'look'): string {
  const directions = (['Up', 'Left', 'Down', 'Right'] as const).map(
    (direction) => bindings.keys[`${kind}${direction}` as Action],
  )
  const sets: string[] = []
  const slots = Math.max(...directions.map((keys) => keys.length))
  for (let slot = 0; slot < slots; slot++) {
    const codes = directions.map((keys) => keys[slot])
    if (codes.some((code) => code === undefined)) continue
    if (codes.every((code) => code?.startsWith('Arrow'))) {
      sets.push(t('arrowKeys'))
      continue
    }
    const names = codes.map((code) => keyName(code as string))
    sets.push(names.every((name) => name.length === 1) ? names.join('') : names.join('/'))
  }
  // Directions with keys of their own outside a full set still count.
  if (sets.length === 0)
    sets.push(
      ...directions
        .flat()
        .map(keyName)
        .filter((name, i, all) => all.indexOf(name) === i),
    )
  return either(sets)
}
