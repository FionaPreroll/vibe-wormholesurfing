import { describe, expect, it } from 'vitest'
import { type Cycle, judge, report } from './judge'

const cycle = (round: number, changes: Partial<Cycle> = {}): Cycle => ({
  round,
  minutes: round,
  world: 'The Canyon',
  heapMB: 40,
  nodes: 900,
  listeners: 200,
  documents: 1,
  geometries: 120,
  textures: 30,
  programs: 25,
  quality: 'low',
  glitches: 0,
  errors: 0,
  contextLost: false,
  fps: 12,
  ...changes,
})

const steady = (count: number, grow: (round: number) => Partial<Cycle> = () => ({})) =>
  Array.from({ length: count }, (_, round) => cycle(round, grow(round)))

describe('judge', () => {
  it('passes a run whose measures hold steady', () => {
    const verdict = judge(steady(10), [])
    expect(verdict.problems).toEqual([])
    expect(verdict.notes.join('\n')).toContain('Geometries (low): 120 → 120')
  })

  it('finds what keeps growing round after round', () => {
    const verdict = judge(
      steady(12, (round) => ({ geometries: 120 + round * 8, heapMB: 40 + round * 20 })),
      [],
    )
    expect(verdict.problems.some((problem) => problem.startsWith('Leak? Geometries (low)'))).toBe(
      true,
    )
    expect(verdict.problems.some((problem) => problem.startsWith('Leak? JavaScript heap'))).toBe(
      true,
    )
  })

  it('finds a texture left behind by one world in five, as the first soak run on GitHub showed', () => {
    const textures = [21, 21, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 25, 25]
    const cycles = steady(textures.length, (round) => ({ textures: textures[round] }))
    expect(judge(cycles, []).problems).toEqual(['Leak? Textures (low): 23 → 25 (+2, allowed +1)'])
  })

  it('lets caches fill while new worlds come up, as long as they stop', () => {
    const cycles = steady(12, (round) => ({ programs: 25 + Math.min(round, 5) * 3 }))
    expect(judge(cycles, []).problems).toEqual([])
  })

  it('compares the GPU only within one graphics quality', () => {
    const cycles = steady(12, (round) =>
      round % 4 < 2 ? { quality: 'low' } : { quality: 'medium', textures: 60, programs: 40 },
    )
    expect(judge(cycles, []).problems).toEqual([])
  })

  it('fails on errors, a lost context and too few rounds', () => {
    const verdict = judge([cycle(0), cycle(1, { errors: 2, contextLost: true })], ['Boom'])
    expect(verdict.problems).toEqual([
      'Too few rounds played: 1',
      'Page error: Boom',
      '2 errors in the debug log',
      'The WebGL context was lost',
    ])
  })

  it('writes a summary with a row for every round', () => {
    const text = report(steady(3), judge(steady(3), []), 20)
    expect(text).toContain('| 2 | 2 | The Canyon | low | 40 |')
  })
})
