import type { DebugReport } from '../game/debugLog'
import { CONTACT_EMAIL, ISSUES_URL } from './links'

const MAX_URL = 7000

/** The few facts that help most with a report, in Markdown, short enough for an address. */
export function reportDetails(report: DebugReport, lines = 10): string {
  const environment = report.environment
  const graphics = (environment.graphics ?? {}) as Record<string, unknown>
  const summary = report.summary
  const notable = report.entries
    .filter((entry) => entry.kind !== 'info')
    .slice(-lines)
    .map((entry) => `- ${(entry.t / 1000).toFixed(1)} s ${entry.kind}: ${entry.message}`)
  return [
    `- Version: ${report.version}`,
    `- Browser: ${String(environment.userAgent ?? 'unknown')}`,
    `- Graphics: ${String(environment.gpuRenderer ?? 'unknown')}, quality ${String(graphics.quality ?? '?')}, pixel ratio ${String(graphics.pixelRatio ?? '?')}`,
    `- Frames: median ${String(summary.fpsMedian)} fps, low ${String(summary.fpsLow)} fps, slowest ${String(summary.slowestFrameMs)} ms`,
    `- Glitches: ${String(summary.glitches)}, errors: ${String(summary.errors)}`,
    ...(notable.length > 0 ? ['', 'Latest glitches and errors:', ...notable] : []),
    '',
    'Please attach the debug log file the game just saved (wormhole-surfing-debug-….json).',
  ].join('\n')
}

/** A whole report, for an email: the questions first, then the facts. */
export function reportBody(report: DebugReport, lines = 10): string {
  return [
    '**What happened?**',
    '',
    '',
    '**What did you expect?**',
    '',
    '',
    '---',
    reportDetails(report, lines),
  ].join('\n')
}

/**
 * A new issue on GitHub, in the bug report form (.github/ISSUE_TEMPLATE/bug_report.yml) with its
 * "Details from the game" filled in, as many of the latest glitches as an address holds.
 */
export function issueUrl(report: DebugReport): string {
  for (let lines = 10; lines >= 0; lines--) {
    const params = new URLSearchParams({
      template: 'bug_report.yml',
      title: 'Problem: ',
      details: reportDetails(report, lines),
    })
    const url = `${ISSUES_URL}/new?${params}`
    if (url.length <= MAX_URL || lines === 0) return url
  }
  return `${ISSUES_URL}/new?template=bug_report.yml`
}

/** An email with the report, for players without a GitHub account. */
export function mailUrl(report: DebugReport): string {
  const subject = encodeURIComponent(`Wormhole Surfing ${report.version}: a problem`)
  const body = encodeURIComponent(reportBody(report, 5))
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
}
