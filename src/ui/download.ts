import { debugLog } from '../game/debugLog'
import { isApp, saveInApp } from './native'

/**
 * Hands the player a file to save, as for the save, the debug log and the collection's picture.
 * The browser downloads it; the Android app, whose WebView cannot, asks where to save it.
 */
export function downloadFile(name: string, content: string | Blob): void {
  const blob =
    typeof content === 'string' ? new Blob([content], { type: 'application/json' }) : content
  if (isApp()) {
    saveInApp(name, blob).catch((error: unknown) =>
      debugLog.log('error', `Saving ${name} failed: ${String(error)}`),
    )
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Some browsers read the address only after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A name for a file from a title: letters and digits, with dashes between words. */
export function fileName(title: string): string {
  return title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'vibe-wormholesurfing'
}
