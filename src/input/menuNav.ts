import { PAD, Pads } from './gamepad'

export type Direction = 'up' | 'down' | 'left' | 'right'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** The element a direction leads to from a box: the nearest one that lies that way. */
export function nearestInDirection<T>(
  from: DOMRect,
  candidates: readonly { item: T; rect: DOMRect }[],
  direction: Direction,
): T | undefined {
  const cx = from.left + from.width / 2
  const cy = from.top + from.height / 2
  let best: T | undefined
  let bestScore = Number.POSITIVE_INFINITY
  for (const { item, rect } of candidates) {
    const x = rect.left + rect.width / 2 - cx
    const y = rect.top + rect.height / 2 - cy
    const along = direction === 'up' ? -y : direction === 'down' ? y : direction === 'left' ? -x : x
    const across = direction === 'up' || direction === 'down' ? Math.abs(x) : Math.abs(y)
    if (along <= 1) continue
    const score = along + across * 2.5
    if (score < bestScore) {
      bestScore = score
      best = item
    }
  }
  return best
}

/**
 * Lets a controller work the menus: the D-pad or left stick moves the focus to the nearest
 * button that way, A presses it and B goes back. Only the topmost dialog takes part when one is
 * open.
 */
export function watchMenuPad(enabled: () => boolean, onBack: () => void): () => void {
  const pads = new Pads()
  let frame = 0
  let repeatAt = 0
  let lastDirection: Direction | undefined
  const poll = (now: number) => {
    const pad = pads.poll()
    if (enabled() && pad.connected) {
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
        moveFocus(direction)
        repeatAt = now + (direction === lastDirection ? 140 : 380)
      }
      lastDirection = direction
      if (pad.pressed.has(PAD.a)) {
        const active = document.activeElement
        if (active instanceof HTMLElement && active !== document.body) active.click()
        else moveFocus('down')
      }
      if (pad.pressed.has(PAD.b)) onBack()
    }
    frame = requestAnimationFrame(poll)
  }
  frame = requestAnimationFrame(poll)
  return () => cancelAnimationFrame(frame)
}

export function moveFocus(direction: Direction): void {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
  const scope: ParentNode = dialogs[dialogs.length - 1] ?? document
  const elements = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.offsetParent !== null || element.getClientRects().length > 0,
  )
  if (elements.length === 0) return
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !elements.includes(active)) {
    elements[0]?.focus()
    return
  }
  const target = nearestInDirection(
    active.getBoundingClientRect(),
    elements
      .filter((element) => element !== active)
      .map((element) => ({ item: element, rect: element.getBoundingClientRect() })),
    direction,
  )
  target?.focus()
  target?.scrollIntoView?.({ block: 'nearest' })
}
