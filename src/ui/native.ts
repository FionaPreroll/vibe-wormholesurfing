import { Capacitor, type PluginListenerHandle, registerPlugin } from '@capacitor/core'

/**
 * What the Android app has beyond the page: saving and sharing files, and the back button. The
 * website and the app are one codebase; in a browser, none of this is used.
 */

/** True inside the Android app. */
export function isApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** The app's own plugin for files (android/…/FilesPlugin.java). */
interface FilesPlugin {
  /** Asks where to save the file, with Android's own dialog, and writes it there. */
  save(options: { name: string; mime: string; data: string }): Promise<{ saved: boolean }>
  /** Hands the file and a text to Android's share sheet. */
  share(options: {
    name: string
    mime: string
    data: string
    title: string
    text: string
  }): Promise<void>
}

let plugin: FilesPlugin | undefined
/** The plugin, registered on first use: only the app has it. */
const files = (): FilesPlugin => {
  plugin ??= registerPlugin<FilesPlugin>('Files')
  return plugin
}

/** A file's bytes as base64, the way they cross to the native side. */
export async function toBase64(content: Blob): Promise<string> {
  const bytes = new Uint8Array(await content.arrayBuffer())
  let binary = ''
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
  }
  return btoa(binary)
}

/** Saves a file where the player chooses; false when they cancelled. */
export async function saveInApp(name: string, content: Blob): Promise<boolean> {
  const { saved } = await files().save({
    name,
    mime: content.type || 'application/octet-stream',
    data: await toBase64(content),
  })
  return saved
}

/** Shares a file with a text through Android's share sheet. */
export async function shareInApp(
  name: string,
  content: Blob,
  title: string,
  text: string,
): Promise<void> {
  await files().share({ name, mime: content.type, data: await toBase64(content), title, text })
}

/**
 * Calls back on Android's back button, which then no longer leaves the app by itself. Returns
 * what stops listening.
 */
export function onBackButton(callback: () => void): () => void {
  if (!isApp()) return () => {}
  let handle: PluginListenerHandle | undefined
  let stopped = false
  void import('@capacitor/app')
    .then(({ App }) => App.addListener('backButton', callback))
    .then((added) => {
      if (stopped) void added.remove()
      else handle = added
    })
    .catch(() => {})
  return () => {
    stopped = true
    void handle?.remove()
  }
}

/** Closes the app, as Android's back button does on the first screen of other apps. */
export function exitApp(): void {
  void import('@capacitor/app').then(({ App }) => App.exitApp()).catch(() => {})
}
