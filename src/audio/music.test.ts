import { describe, expect, it } from 'vitest'
import { chordNotes, frequency, MOODS, scaleNote } from './music'

describe('music', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(frequency(69)).toBe(440)
    expect(frequency(81)).toBeCloseTo(880)
  })

  it('walks the scale and wraps into the next octave', () => {
    const mood = MOODS.canyon
    expect(scaleNote(mood, 0)).toBe(mood.root)
    expect(scaleNote(mood, mood.scale.length)).toBe(mood.root + 12)
    expect(scaleNote(mood, -1)).toBe(mood.root - 12 + (mood.scale.at(-1) ?? 0))
  })

  it('builds chords of three rising notes', () => {
    const [a, b, c] = chordNotes(MOODS.title, 0)
    expect(a).toBeLessThan(b as number)
    expect(b).toBeLessThan(c as number)
  })
})
