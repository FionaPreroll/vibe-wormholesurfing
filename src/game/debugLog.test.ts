import { describe, expect, it } from 'vitest'
import { DebugLog, percentile } from './debugLog'

describe('percentile', () => {
  it('picks values by rank', () => {
    expect(percentile([5, 1, 3, 2, 4], 0.5)).toBe(3)
    expect(percentile([5, 1, 3, 2, 4], 1)).toBe(5)
    expect(percentile([], 0.5)).toBe(0)
  })
})

describe('DebugLog', () => {
  it('keeps entries and sums them up', () => {
    let now = 0
    const log = new DebugLog(() => now)
    log.log('info', 'start')
    now = 2000
    log.log('glitch', 'black frame', { screen: 'world' })
    log.sample({
      t: 2000,
      screen: 'world',
      fps: 58,
      frameAvg: 17,
      frameP95: 20,
      frameMax: 40,
      pixelRatio: 2,
      drawCalls: 120,
      triangles: 400_000,
      geometries: 80,
      textures: 20,
    })
    const report = log.report('1.0.0', { quality: 'high' })
    expect(report.format).toBe('vibe-wormholesurfing-debug-log')
    expect(report.entries).toHaveLength(2)
    expect(report.summary).toMatchObject({
      glitches: 1,
      errors: 0,
      fpsMedian: 58,
      slowestFrameMs: 40,
    })
    expect(report.environment).toMatchObject({ quality: 'high' })
  })

  // A two-hour log from Windows held only its last quarter of an hour: the seconds are kept that
  // long, so the minutes are kept for the whole session.
  it('sums every minute of a long session up, past the seconds it keeps', () => {
    const log = new DebugLog(() => 0)
    const seconds = 2 * 60 * 60
    for (let second = 0; second < seconds; second++)
      log.sample({
        t: second * 1000,
        screen: second < 3600 ? 'title' : 'ride',
        fps: second === 90 ? 20 : 144,
        frameAvg: 6.9,
        frameP95: 7.1,
        frameMax: second === 90 ? 83 : 7.1,
        pixelRatio: 1,
        drawCalls: 150,
        triangles: 110_000,
        // A leak of a geometry a minute would show over the session.
        geometries: 70 + Math.floor(second / 60),
        textures: 23,
        heapMB: 30 + (second % 30),
      })
    const report = log.report('1.0.0')
    expect(report.samples).toHaveLength(900)
    expect(report.minutes).toHaveLength(120)
    expect(report.summary.sessionMinutes).toBe(120)
    const second = report.minutes?.[1]
    expect(second).toMatchObject({ t: 60_000, screen: 'title', fps: 144, fpsLow: 20, frameMax: 83 })
    expect(second?.heapMB).toBe(59)
    expect(report.minutes?.[119]?.screen).toBe('ride')
    expect(report.minutes?.[119]?.geometries).toBe(70 + 119)
  })

  it('counts quick repeats of a message instead of logging each', () => {
    let now = 0
    const log = new DebugLog(() => now)
    for (let index = 0; index < 50; index++) {
      now += 10
      log.log('warn', 'same thing')
    }
    now += 5000
    log.log('info', 'other')
    expect(log.entries.map((entry) => entry.message)).toEqual([
      'same thing',
      '(the line before repeated 49 times)',
      'other',
    ])
  })

  it('keeps only the newest entries', () => {
    let now = 0
    const log = new DebugLog(() => now)
    for (let index = 0; index < 700; index++) {
      now += 2000
      log.log('info', `line ${index}`)
    }
    expect(log.entries).toHaveLength(600)
    expect(log.entries[0]?.message).toBe('line 100')
  })
})
