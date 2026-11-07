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

/**
 * The local date and time to the second for file names, as 2026-11-07_04-06-27: each export
 * gets a name of its own, and no colons, which Windows does not allow in names.
 */
export function stamp(date = new Date()): string {
  const two = (value: number) => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}_` +
    `${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}`
  )
}
