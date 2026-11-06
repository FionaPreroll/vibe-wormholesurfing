import { useRef } from 'preact/hooks'

interface Handlers {
  readonly onPointerDown: (event: PointerEvent) => void
  readonly onClick: (event: MouseEvent) => void
}

/**
 * Closes a dialog when the player clicks or taps the dim backdrop around it. Both the press and
 * the release must land on the backdrop itself, so selecting text in the dialog and letting go
 * outside does not close it.
 */
export function useBackdropDismiss(onDismiss: () => void): Handlers {
  const pressed = useRef(false)
  return {
    onPointerDown: (event) => {
      pressed.current = event.target === event.currentTarget
    },
    onClick: (event) => {
      const outside = event.target === event.currentTarget && pressed.current
      pressed.current = false
      if (outside) onDismiss()
    },
  }
}
