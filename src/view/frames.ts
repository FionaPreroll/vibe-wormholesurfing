/** Waits until the next frame has been drawn: work done after it stalls no frame of its own. */
export function afterNextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
}

/**
 * A frame later than this did not stall: the browser stopped drawing, as macOS does for a window
 * that is covered, while the page still counts as visible. The game's own longest stalls, such as
 * compiling shaders, stay well below it.
 */
export const PAUSE_S = 3
/** A frame later than this is a stall worth a line in the debug log. */
export const LONG_FRAME_S = 0.25

/**
 * What a frame's lateness says: the game is still starting, the browser paused drawing, the game
 * stalled (only while the page shows, as a hidden page draws seldom by design), or nothing.
 * `shown` says whether the game had put a picture on the screen when the frame began: before its
 * first picture nothing on the screen moves, so a late frame then is the game starting, building
 * its first scene and drawing it, not a stall a player sees.
 */
export function frameKind(
  seconds: number,
  visible: boolean,
  shown = true,
): 'starting' | 'paused' | 'long' | 'fine' {
  if (!shown) return seconds > LONG_FRAME_S && visible ? 'starting' : 'fine'
  if (seconds > PAUSE_S) return 'paused'
  return seconds > LONG_FRAME_S && visible ? 'long' : 'fine'
}
