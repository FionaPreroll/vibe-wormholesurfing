import { describe, expect, it } from 'vitest'
import { DebugLog } from '../game/debugLog'
import { issueUrl, mailUrl, reportBody } from './report'

function sample() {
  let now = 0
  const log = new DebugLog(() => now)
  log.setEnvironment({ userAgent: 'Test Browser', gpuRenderer: 'Apple M3' })
  for (let index = 0; index < 400; index++) {
    now += 2000
    log.log('glitch', `Long frame number ${index} with a fairly long description of what happened`)
  }
  return log.report('1.2.3', { graphics: { quality: 'high', pixelRatio: 1.2 } })
}

describe('reports', () => {
  it('sums up the device, the frames and the latest glitches', () => {
    const body = reportBody(sample())
    expect(body).toContain('Version: 1.2.3')
    expect(body).toContain('Apple M3, quality high, pixel ratio 1.2')
    expect(body).toContain('Long frame number 399')
    expect(body).not.toContain('Long frame number 380')
  })

  it('makes an issue address short enough for GitHub and an email', () => {
    const url = issueUrl(sample())
    expect(url.startsWith('https://github.com/FionaPreroll/vibe-wormholesurfing/issues/new?')).toBe(
      true,
    )
    expect(url.length).toBeLessThanOrEqual(7000)
    // The bug report form, its details filled in with the device and the latest glitches.
    const params = new URL(url).searchParams
    expect(params.get('template')).toBe('bug_report.yml')
    expect(params.get('details')).toContain('Version: 1.2.3')
    expect(params.get('body')).toBeNull()
    expect(mailUrl(sample()).startsWith('mailto:fipreroll+app@gmail.com?subject=')).toBe(true)
  })
})
