/** Waits until the next frame has been drawn: work done after it stalls no frame of its own. */
export function afterNextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
}
