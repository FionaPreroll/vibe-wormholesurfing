import { describe, expect, it } from 'vitest'
import { DebugLog } from '../game/debugLog'
import { sessionLength } from './DataTools'

const kept = (seconds: number) => {
  const report = new DebugLog(() => 0).report('1.0.0')
  const savedAt = new Date(Date.parse(report.openedAt) + seconds * 1000).toISOString()
  return { id: report.openedAt, savedAt, report }
}

describe('sessionLength', () => {
  it('writes short sessions in seconds and longer ones in minutes', () => {
    expect(sessionLength(kept(42))).toBe('42 s')
    expect(sessionLength(kept(12 * 60 + 20))).toBe('12 min')
  })
})
