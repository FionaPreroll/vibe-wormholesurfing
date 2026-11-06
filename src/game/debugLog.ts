/** What a line of the debug log is about. */
export type LogKind = 'info' | 'warn' | 'error' | 'glitch'

export interface LogEntry {
  /** Milliseconds since the page opened. */
  readonly t: number
  readonly kind: LogKind
  readonly message: string
  readonly data?: Readonly<Record<string, unknown>>
}

/** One second of drawing, summed up. */
export interface PerfSample {
  readonly t: number
  readonly screen: string
  readonly fps: number
  /** Frame times in milliseconds: average, 95th percentile and slowest. */
  readonly frameAvg: number
  readonly frameP95: number
  readonly frameMax: number
  readonly pixelRatio: number
  readonly drawCalls: number
  readonly triangles: number
  readonly geometries: number
  readonly textures: number
  /** JavaScript memory in MB, where the browser tells. */
  readonly heapMB?: number
}

export interface DebugReport {
  readonly format: 'vibe-wormholesurfing-debug-log'
  readonly version: string
  readonly createdAt: string
  readonly openedAt: string
  readonly environment: Readonly<Record<string, unknown>>
  readonly summary: Readonly<Record<string, unknown>>
  readonly entries: readonly LogEntry[]
  readonly samples: readonly PerfSample[]
}

const MAX_ENTRIES = 600
const MAX_SAMPLES = 900

/** Percentile of a list of numbers, 0 to 1. */
export function percentile(values: readonly number[], share: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1))
  return sorted[index] as number
}

/**
 * A record of what happened while the game ran: the device, how fast frames came, and anything
 * that went wrong, for players to export and send along with a bug report.
 */
export class DebugLog {
  readonly entries: LogEntry[] = []
  readonly samples: PerfSample[] = []
  readonly environment: Record<string, unknown> = {}
  readonly openedAt = new Date()
  readonly #now: () => number
  /** Repeats of the same message within a second count instead of filling the log. */
  #last: { message: string; t: number; repeats: number } | undefined

  constructor(
    now: () => number = () => (typeof performance === 'undefined' ? Date.now() : performance.now()),
  ) {
    this.#now = now
  }

  log(kind: LogKind, message: string, data?: Record<string, unknown>): void {
    const t = Math.round(this.#now())
    const last = this.#last
    if (last && last.message === message && t - last.t < 1000) {
      last.repeats++
      return
    }
    if (last && last.repeats > 0)
      this.#push({
        t: last.t,
        kind: 'info',
        message: `(the line before repeated ${last.repeats} times)`,
      })
    this.#last = { message, t, repeats: 0 }
    this.#push(data ? { t, kind, message, data } : { t, kind, message })
  }

  #push(entry: LogEntry): void {
    this.entries.push(entry)
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES)
  }

  sample(sample: PerfSample): void {
    this.samples.push(sample)
    if (this.samples.length > MAX_SAMPLES) this.samples.splice(0, this.samples.length - MAX_SAMPLES)
  }

  setEnvironment(patch: Record<string, unknown>): void {
    Object.assign(this.environment, patch)
  }

  /** How many entries there are of each kind, and how frames went overall. */
  summary(): Record<string, unknown> {
    const count = (kind: LogKind) => this.entries.filter((entry) => entry.kind === kind).length
    const fps = this.samples.map((sample) => sample.fps)
    return {
      errors: count('error'),
      warnings: count('warn'),
      glitches: count('glitch'),
      seconds: this.samples.length,
      fpsMedian: percentile(fps, 0.5),
      fpsLow: percentile(fps, 0.05),
      slowestFrameMs: Math.max(0, ...this.samples.map((sample) => sample.frameMax)),
    }
  }

  report(version: string, extra: Record<string, unknown> = {}): DebugReport {
    return {
      format: 'vibe-wormholesurfing-debug-log',
      version,
      createdAt: new Date().toISOString(),
      openedAt: this.openedAt.toISOString(),
      environment: { ...this.environment, ...extra },
      summary: this.summary(),
      entries: [...this.entries],
      samples: [...this.samples],
    }
  }
}

/** The game's one log. */
export const debugLog = new DebugLog()

function asText(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Writes uncaught errors, rejected promises and the console's warnings and errors into the log.
 * Returns a function that stops.
 */
export function captureErrors(log: DebugLog = debugLog): () => void {
  const onError = (event: ErrorEvent) =>
    log.log('error', event.message, {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    })
  const onRejection = (event: PromiseRejectionEvent) =>
    log.log('error', `Unhandled rejection: ${asText(event.reason)}`)
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  const original = { warn: console.warn, error: console.error }
  console.warn = (...args: unknown[]) => {
    log.log('warn', args.map(asText).join(' ').slice(0, 500))
    original.warn.apply(console, args)
  }
  console.error = (...args: unknown[]) => {
    log.log('error', args.map(asText).join(' ').slice(0, 500))
    original.error.apply(console, args)
  }
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    console.warn = original.warn
    console.error = original.error
  }
}
