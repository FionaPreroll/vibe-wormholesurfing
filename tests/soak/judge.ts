/**
 * What the soak test makes of its measurements (tests/soak/soak.spec.ts): growth from the first
 * rounds to the last that would not stop is a leak; errors and a lost WebGL context fail it too.
 */

/** What one round left behind, measured on the title screen after garbage collection. */
export interface Measure {
  readonly heapMB: number
  readonly nodes: number
  readonly listeners: number
  readonly documents: number
  readonly geometries: number
  readonly textures: number
  readonly programs: number
  readonly quality: string
  readonly glitches: number
  readonly errors: number
  readonly contextLost: boolean
  /** The median frames per second of the debug log so far. */
  readonly fps: number
}

export interface Cycle extends Measure {
  /** 0 before the first ride. */
  readonly round: number
  readonly minutes: number
  readonly world: string
}

export interface Verdict {
  readonly problems: string[]
  readonly notes: string[]
}

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

/**
 * How much a measure may grow from the first rounds to the last before it counts as a leak: an
 * amount, or a share of where it started, whichever is more.
 */
export const ALLOWED: Readonly<Record<string, { amount: number; share: number }>> = {
  heapMB: { amount: 30, share: 0.25 },
  nodes: { amount: 500, share: 0.25 },
  listeners: { amount: 100, share: 0.25 },
  documents: { amount: 2, share: 0 },
  geometries: { amount: 10, share: 0.1 },
  textures: { amount: 6, share: 0.1 },
  programs: { amount: 6, share: 0.15 },
}

/**
 * The first half of the run against its end: the highest value of the first half, after the
 * first round's warm-up, and the median of the last three rounds. Caches that fill as new worlds
 * come up, as three.js's shader programs do, stop growing within the first half; a leak goes on.
 */
function compare(cycles: readonly Cycle[], key: keyof Measure) {
  const played = cycles.filter((cycle) => cycle.round > 0)
  const values = played.map((cycle) => Number(cycle[key]))
  if (values.length < 2) return undefined
  const half = values.slice(0, Math.ceil(values.length / 2))
  return { first: Math.max(...half), last: median(values.slice(-Math.min(3, half.length))) }
}

function check(
  problems: string[],
  notes: string[],
  cycles: readonly Cycle[],
  key: keyof Measure,
  label: string,
): void {
  const seen = compare(cycles, key)
  const allowed = ALLOWED[key]
  if (!seen || !allowed) return
  const growth = seen.last - seen.first
  const limit = Math.max(allowed.amount, seen.first * allowed.share)
  const line = `${label}: ${round(seen.first)} → ${round(seen.last)} (${growth >= 0 ? '+' : ''}${round(growth)}, allowed +${round(limit)})`
  if (growth > limit) problems.push(`Leak? ${line}`)
  else notes.push(line)
}

const round = (value: number) => Math.round(value * 10) / 10

export function judge(cycles: readonly Cycle[], pageErrors: readonly string[]): Verdict {
  const problems: string[] = []
  const notes: string[] = []
  const last = cycles.at(-1)
  if (!last) return { problems: ['No measurements'], notes }
  if (cycles.length < 4) problems.push(`Too few rounds played: ${cycles.length - 1}`)
  for (const error of pageErrors.slice(0, 10)) problems.push(`Page error: ${error}`)
  if (last.errors > 0) problems.push(`${last.errors} errors in the debug log`)
  if (cycles.some((cycle) => cycle.contextLost)) problems.push('The WebGL context was lost')

  check(problems, notes, cycles, 'heapMB', 'JavaScript heap, MB')
  check(problems, notes, cycles, 'nodes', 'Page elements')
  check(problems, notes, cycles, 'listeners', 'Event listeners')
  check(problems, notes, cycles, 'documents', 'Documents')
  // What the GPU holds depends on the graphics quality, which the tours switch: each quality is
  // compared with itself.
  for (const quality of new Set(cycles.map((cycle) => cycle.quality))) {
    const same = cycles.filter((cycle) => cycle.quality === quality)
    if (same.filter((cycle) => cycle.round > 0).length < 2) continue
    check(problems, notes, same, 'geometries', `Geometries (${quality})`)
    check(problems, notes, same, 'textures', `Textures (${quality})`)
    check(problems, notes, same, 'programs', `Shader programs (${quality})`)
  }
  notes.push(`Glitches noted by the game: ${last.glitches}`)
  notes.push(
    `Median frames per second: ${cycles[1]?.fps ?? 0} after the first round, ${last.fps} at the end`,
  )
  return { problems, notes }
}

/** The run as Markdown, for the workflow's summary. */
export function report(cycles: readonly Cycle[], verdict: Verdict, minutes: number): string {
  const rows = cycles.map(
    (cycle) =>
      `| ${cycle.round} | ${cycle.minutes} | ${cycle.world || '–'} | ${cycle.quality} | ${cycle.heapMB} | ${cycle.geometries} | ${cycle.textures} | ${cycle.programs} | ${cycle.nodes} | ${cycle.listeners} | ${cycle.fps} |`,
  )
  return [
    `## Soak test: ${verdict.problems.length === 0 ? 'passed' : 'failed'}`,
    '',
    `${cycles.length - 1} rounds in ${cycles.at(-1)?.minutes ?? 0} minutes (planned: ${minutes}).`,
    '',
    ...(verdict.problems.length > 0
      ? ['### Problems', '', ...verdict.problems.map((problem) => `- ${problem}`), '']
      : []),
    '### Measures, first rounds → last',
    '',
    ...verdict.notes.map((note) => `- ${note}`),
    '',
    '### Every round, on the title screen after garbage collection',
    '',
    '| Round | Minutes | World | Quality | Heap MB | Geometries | Textures | Programs | Elements | Listeners | FPS |',
    '| ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
  ].join('\n')
}
