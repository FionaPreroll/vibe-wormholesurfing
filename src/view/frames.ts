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
/**
 * A frame later than this is a stall worth a line in the debug log: on a screen of 144 Hz, as
 * many frames as fill a seventh of a second, which shows. It once was a quarter of a second, which
 * let a stall of 194 ms go by without a line.
 */
export const LONG_FRAME_S = 0.1
/**
 * ...and later than this many of the frames the game draws as a rule: a device that draws ten
 * frames a second all along is slow, not stalling, and would fill the log with every frame.
 */
export const STALL_TIMES = 4

/**
 * What a frame's lateness says: the game is still starting, the browser paused drawing, the game
 * stalled (only while the page shows, as a hidden page draws seldom by design), or nothing.
 * `shown` says whether the game had put a picture on the screen when the frame began: before its
 * first picture nothing on the screen moves, so a late frame then is the game starting, building
 * its first scene and drawing it, not a stall a player sees. `usual` is how long the frames took
 * of late, on average, in seconds; 0 until a second has been counted.
 */
export function frameKind(
  seconds: number,
  visible: boolean,
  shown = true,
  usual = 0,
): 'starting' | 'paused' | 'long' | 'fine' {
  const late = seconds > Math.max(LONG_FRAME_S, usual * STALL_TIMES) && visible
  if (!shown) return late ? 'starting' : 'fine'
  if (seconds > PAUSE_S) return 'paused'
  return late ? 'long' : 'fine'
}
