import { signal } from '@preact/signals'
import { debugLog } from '../game/debugLog'

/** How far the download of the 3D view has come. */
export interface Download {
  /** Bytes arrived so far, unpacked. */
  readonly loaded: number
  /** Bytes in all, when the build told; undefined on the dev server. */
  readonly total: number | undefined
  /** Milliseconds since the download began. */
  readonly elapsed: number
  /** Bytes per second, averaged over the download so far. */
  readonly speed: number
  readonly done: boolean
}

/** The download in progress, for the loading screen. */
export const download = signal<Download | undefined>(undefined)

/** The 3D view's files and sizes, written in by tools/lazyFiles.ts when the game is built. */
const RAW = '__LAZY_VIEW_FILES__'

export function lazyViewFiles(raw: string = RAW): { file: string; bytes: number }[] {
  if (!raw.startsWith('[')) return []
  try {
    const files = JSON.parse(raw) as unknown
    return Array.isArray(files)
      ? files.filter(
          (entry): entry is { file: string; bytes: number } =>
            typeof entry?.file === 'string' && typeof entry?.bytes === 'number',
        )
      : []
  } catch {
    return []
  }
}

/** A size for people: bytes, KiB or MiB, with one decimal where it helps. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

/** A duration for people: tenths of seconds below a minute. */
export function formatSeconds(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')} min`
}

/**
 * Fetches the 3D view's files and counts their bytes as they come, so the loading screen can
 * show progress, speed and time. The browser keeps them, so the import that follows is quick.
 * Where the sizes are unknown, as on the dev server, it only counts time while `load` runs.
 */
export async function loadWithProgress<T>(
  load: () => Promise<T>,
  now: () => number = () => performance.now(),
): Promise<T> {
  const files = lazyViewFiles()
  const start = now()
  const total = files.length > 0 ? files.reduce((sum, file) => sum + file.bytes, 0) : undefined
  let loaded = 0
  let frame = 0
  const publish = (done = false) => {
    const elapsed = now() - start
    download.value = {
      loaded,
      total,
      elapsed,
      speed: elapsed > 0 ? (loaded * 1000) / elapsed : 0,
      done,
    }
  }
  // Time runs on even when no bytes can be counted.
  const tick = () => {
    publish()
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  try {
    if (files.length > 0 && typeof ReadableStream !== 'undefined') {
      await Promise.all(
        files.map(async ({ file }) => {
          try {
            const response = await fetch(new URL(file, document.baseURI))
            const reader = response.body?.getReader()
            if (!reader) return
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              loaded += value.byteLength
            }
          } catch {
            // The import below still loads it; only the progress is lost.
          }
        }),
      )
    }
    const result = await load()
    if (total !== undefined) loaded = Math.max(loaded, total)
    publish(true)
    const finished = download.value
    debugLog.log('info', '3D view loaded', {
      ms: Math.round(finished?.elapsed ?? 0),
      bytes: finished?.loaded ?? 0,
      bytesPerSecond: Math.round(finished?.speed ?? 0),
      transferred: transferredBytes(files.map((file) => file.file)),
    })
    return result
  } finally {
    cancelAnimationFrame(frame)
  }
}

/** Bytes that went over the network for these files, packed, as the browser measured them. */
function transferredBytes(files: readonly string[]): number | undefined {
  if (typeof performance.getEntriesByType !== 'function') return undefined
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  const matching = entries.filter((entry) => files.some((file) => entry.name.endsWith(file)))
  return matching.length > 0
    ? matching.reduce((sum, entry) => sum + entry.transferSize, 0)
    : undefined
}
