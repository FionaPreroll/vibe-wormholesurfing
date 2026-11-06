import { PAD, Pads } from './gamepad'

export type Direction = 'up' | 'down' | 'left' | 'right'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** How far apart two stretches of a line lie: none when they overlap. */
function gap(start: number, end: number, otherStart: number, otherEnd: number): number {
  return Math.max(0, otherStart - end, start - otherEnd)
}

/**
 * The element a direction leads to from a box. Up and down go to the next row of controls and
 * never past one, to the box in it that lies most in line; left and right stay in the row and go
 * to the nearest box beside this one.
 */
export function nearestInDirection<T>(
  from: DOMRect,
  candidates: readonly { item: T; rect: DOMRect }[],
  direction: Direction,
): T | undefined {
  const vertical = direction === 'up' || direction === 'down'
  const forward = direction === 'down' || direction === 'right' ? 1 : -1
  const centerX = (rect: DOMRect) => rect.left + rect.width / 2
  const centerY = (rect: DOMRect) => rect.top + rect.height / 2
  const along = (rect: DOMRect) =>
    forward * (vertical ? centerY(rect) - centerY(from) : centerX(rect) - centerX(from))
  const across = (rect: DOMRect) =>
    vertical
      ? gap(from.left, from.left + from.width, rect.left, rect.left + rect.width)
      : gap(from.top, from.top + from.height, rect.top, rect.top + rect.height)
  // Between boxes as near, the one most in line wins.
  const offset = (rect: DOMRect) =>
    vertical ? Math.abs(centerX(rect) - centerX(from)) : Math.abs(centerY(rect) - centerY(from))
  const ahead = candidates.filter(({ rect }) => along(rect) > 1)
  const best = (
    pool: readonly { item: T; rect: DOMRect }[],
    score: (rect: DOMRect) => number,
  ): T | undefined => {
    let found: T | undefined
    let lowest = Number.POSITIVE_INFINITY
    for (const { item, rect } of pool) {
      const value = score(rect) + offset(rect) * 0.01
      if (value < lowest) {
        lowest = value
        found = item
      }
    }
    return found
  }
  if (!vertical)
    return best(
      ahead.filter(({ rect }) => across(rect) <= 2),
      along,
    )
  // The next row: the box whose near edge comes first, and all that share its height.
  const edge = (rect: DOMRect) => (forward > 0 ? rect.top : -(rect.top + rect.height))
  let first: DOMRect | undefined
  for (const { rect } of ahead) if (!first || edge(rect) < edge(first)) first = rect
  if (!first) return undefined
  const row = first
  return best(
    ahead.filter(
      ({ rect }) => gap(row.top, row.top + row.height, rect.top, rect.top + rect.height) <= 2,
    ),
    across,
  )
}

/** Fires the events a person's change would, so the menus take it as one. */
function changed(element: HTMLElement): void {
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Left and right change what a control holds, where it holds a value: a slider moves a step, at
 * least a twentieth of its range, and a list goes to its next or previous choice. Returns whether
 * the control took the press; elsewhere it moves the focus.
 */
export function adjustControl(element: Element | null, direction: 'left' | 'right'): boolean {
  const sign = direction === 'right' ? 1 : -1
  if (element instanceof HTMLInputElement && element.type === 'range') {
    const min = Number(element.min || 0)
    const max = Number(element.max || 100)
    const step = Math.max(Number(element.step) || 1, (max - min) / 20)
    const next = Math.min(max, Math.max(min, Number(element.value) + sign * step))
    if (next === Number(element.value)) return true
    element.value = String(next)
    changed(element)
    return true
  }
  if (element instanceof HTMLSelectElement) {
    const count = element.options.length
    if (count === 0) return true
    element.selectedIndex = (element.selectedIndex + sign + count) % count
    changed(element)
    return true
  }
  return false
}

let held = false

/**
 * Keeps the controller out of the menus for a while, as when the next button pressed is to be
 * bound to an action. The menus keep reading the controller meanwhile, so the button that ends
 * the wait does not count as a press once they take over again.
 */
export function holdMenuPad(on: boolean): void {
  held = on
}

/** The topmost dialog, or the page, as far as the menus are concerned. */
function scope(): ParentNode {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
  return dialogs[dialogs.length - 1] ?? document
}

/** Scrolls whatever scrolls in the topmost dialog or page: the right stick reads long texts. */
function scrollBy(pixels: number): void {
  const root = scope()
  const candidates = [
    ...(root instanceof Document ? [] : [root as HTMLElement]),
    ...root.querySelectorAll<HTMLElement>('*'),
  ]
  const scroller = candidates.find(
    (element) =>
      element.scrollHeight > element.clientHeight + 1 &&
      ['auto', 'scroll'].includes(getComputedStyle(element).overflowY),
  )
  scroller?.scrollBy({ top: pixels })
}

/**
 * Lets a controller work the menus: the D-pad or left stick moves the focus to the nearest
 * control that way, and left and right change sliders and lists; A presses, ticks or goes to the
 * next choice, B goes back, and the right stick scrolls. Only the topmost dialog takes part when
 * one is open.
 */
export function watchMenuPad(enabled: () => boolean, onBack: () => void): () => void {
  const pads = new Pads()
  let frame = 0
  let repeatAt = 0
  let lastDirection: Direction | undefined
  const poll = (now: number) => {
    const pad = pads.poll()
    if (enabled() && pad.connected && !held) {
      const { x, y } = pad.move
      const direction: Direction | undefined =
        Math.abs(x) < 0.5 && Math.abs(y) < 0.5
          ? undefined
          : Math.abs(x) > Math.abs(y)
            ? x > 0
              ? 'right'
              : 'left'
            : y > 0
              ? 'up'
              : 'down'
      if (direction && (direction !== lastDirection || now >= repeatAt)) {
        const sideways = direction === 'left' || direction === 'right'
        if (!sideways || !adjustControl(document.activeElement, direction)) moveFocus(direction)
        repeatAt = now + (direction === lastDirection ? 140 : 380)
      }
      lastDirection = direction
      if (Math.abs(pad.look.y) > 0.2) scrollBy(-pad.look.y * 18)
      if (pad.pressed.has(PAD.a)) {
        const active = document.activeElement
        if (active instanceof HTMLSelectElement) adjustControl(active, 'right')
        else if (active instanceof HTMLElement && active !== document.body) active.click()
        else moveFocus('down')
      }
      if (pad.pressed.has(PAD.b)) onBack()
    }
    frame = requestAnimationFrame(poll)
  }
  frame = requestAnimationFrame(poll)
  return () => cancelAnimationFrame(frame)
}

/** Where a control shows: the label around a hidden one, such as a file picker's. */
function boxOf(element: HTMLElement): DOMRect {
  const own = element.getBoundingClientRect()
  const label = element.closest('label')
  return (own.width < 4 || own.height < 4) && label ? label.getBoundingClientRect() : own
}

export function moveFocus(direction: Direction): void {
  const elements = [...scope().querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.offsetParent !== null || element.getClientRects().length > 0,
  )
  if (elements.length === 0) return
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !elements.includes(active)) {
    elements[0]?.focus()
    return
  }
  const target = nearestInDirection(
    boxOf(active),
    elements
      .filter((element) => element !== active)
      .map((element) => ({ item: element, rect: boxOf(element) })),
    direction,
  )
  target?.focus()
  ;(target?.closest('label') ?? target)?.scrollIntoView?.({ block: 'nearest' })
}
