import { describe, expect, it } from 'vitest'
import { DebugLog } from '../game/debugLog'
import { KEPT_LOGS, LogArchive } from './logs'
import { memoryStore } from './store'

const report = (message: string) => {
  const log = new DebugLog(() => 0)
  log.log('info', message)
  return log.report('1.0.0')
}

describe('LogArchive', () => {
  it('keeps the latest sessions, each replacing its own entry', async () => {
    const store = memoryStore()
    for (const session of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']) {
      const archive = new LogArchive(store, session)
      await archive.keep(report(`${session} first`))
      await archive.keep(report(`${session} later`))
    }
    const logs = await new LogArchive(store, 'x').list()
    expect(logs).toHaveLength(KEPT_LOGS)
    expect(logs.map((log) => log.id)).toEqual(['2026-11-04', '2026-11-03', '2026-11-02'])
    expect(logs[0]?.report.entries[0]?.message).toBe('2026-11-04 later')
  })

  it('ignores what it cannot read', async () => {
    const store = memoryStore({ debugLogs: [{ id: 'broken' }, 42] })
    expect(await new LogArchive(store, 'x').list()).toEqual([])
  })
})
