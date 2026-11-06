import type { DebugReport } from '../game/debugLog'
import { SaveQueue } from './queue'
import type { KeyValueStore } from './store'

const KEY = 'debugLogs'

/** How many sessions' debug logs the browser keeps. */
export const KEPT_LOGS = 3

/** A session's debug log as the browser keeps it. */
export interface StoredLog {
  /** Which session it is: the time the page opened. */
  readonly id: string
  readonly savedAt: string
  readonly report: DebugReport
}

function isStoredLog(value: unknown): value is StoredLog {
  if (!value || typeof value !== 'object') return false
  const log = value as Partial<StoredLog>
  return (
    typeof log.id === 'string' &&
    typeof log.savedAt === 'string' &&
    typeof log.report === 'object' &&
    log.report !== null &&
    (log.report as Partial<DebugReport>).format === 'vibe-wormholesurfing-debug-log'
  )
}

/**
 * The debug logs of the latest sessions, this one included, so a glitch can still be reported
 * after the page was closed. Each session keeps replacing its own entry as it goes on.
 */
export class LogArchive {
  readonly #queue = new SaveQueue()

  constructor(
    readonly store: KeyValueStore,
    readonly session: string,
  ) {}

  /** The kept logs, newest first. */
  async list(): Promise<StoredLog[]> {
    const stored = await this.store.get(KEY)
    const logs = Array.isArray(stored) ? stored.filter(isStoredLog) : []
    return logs.sort((a, b) => b.id.localeCompare(a.id)).slice(0, KEPT_LOGS)
  }

  /** Keeps this session's log, dropping the oldest beyond the limit. */
  keep(report: DebugReport, now = new Date()): Promise<void> {
    return this.#queue.run(async () => {
      const others = (await this.list()).filter((log) => log.id !== this.session)
      const logs = [{ id: this.session, savedAt: now.toISOString(), report }, ...others]
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, KEPT_LOGS)
      await this.store.set(KEY, logs)
    })
  }
}
