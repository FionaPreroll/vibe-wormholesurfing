import { effect, type ReadonlySignal } from '@preact/signals-core'
import type { Source } from '../input/input'

/** How long the mouse may rest over a ride or a world before its pointer goes. */
export const CURSOR_IDLE_MS = 2500

function show(shown: boolean): void {
  const root = document.documentElement
  if (shown) delete root.dataset.cursor
  else root.dataset.cursor = 'hidden'
}

/**
 * Hides the mouse pointer while the mouse is not in use, in a browser tab as in the installed
 * app: as soon as a controller, the keys or tilting steer, and when the mouse rests a while over
 * a ride or a world. Moving the mouse shows it again at once. In the menus a resting mouse keeps
 * its pointer, as a player may be reading.
 */
export function watchCursor(source: ReadonlySignal<Source>, playing: () => boolean): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const rest = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (playing()) show(false)
    }, CURSOR_IDLE_MS)
  }
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || (event.movementX === 0 && event.movementY === 0)) return
    show(true)
    rest()
  }
  const onKey = (event: KeyboardEvent) => {
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) show(false)
  }
  let first = true
  const stopSource = effect(() => {
    const now = source.value
    // Whatever steers first at the start says nothing yet.
    if (first) {
      first = false
      return
    }
    if (now !== 'mouse') show(false)
  })
  window.addEventListener('pointermove', onMove)
  window.addEventListener('keydown', onKey)
  rest()
  return () => {
    clearTimeout(timer)
    stopSource()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('keydown', onKey)
    show(true)
  }
}
