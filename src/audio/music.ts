/** A mood of the generated music: its key, scale, pace and colors. */
export interface Mood {
  /** MIDI note of the key's root. */
  readonly root: number
  /** Steps of the scale above the root. */
  readonly scale: readonly number[]
  /** Chords as scale degrees, one per bar. */
  readonly chords: readonly number[]
  readonly bpm: number
  /** Arpeggio notes per beat; 0 for none. */
  readonly arp: number
  readonly pad: OscillatorType
  readonly lead: OscillatorType
  /** Brightness of the pad's filter in Hz. */
  readonly bright: number
}

const LYDIAN = [0, 2, 4, 6, 7, 9, 11]
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
const PENTA = [0, 2, 4, 7, 9]
const MINOR_PENTA = [0, 3, 5, 7, 10]
const WHOLE = [0, 2, 4, 6, 8, 10]

export const MOODS = {
  title: {
    root: 50,
    scale: LYDIAN,
    chords: [0, 4, 5, 3],
    bpm: 76,
    arp: 2,
    pad: 'sawtooth',
    lead: 'triangle',
    bright: 1400,
  },
  ride: {
    root: 50,
    scale: LYDIAN,
    chords: [0, 5, 3, 4],
    bpm: 104,
    arp: 4,
    pad: 'sawtooth',
    lead: 'square',
    bright: 2200,
  },
  cliffs: {
    root: 45,
    scale: DORIAN,
    chords: [0, 3, 6, 4],
    bpm: 72,
    arp: 2,
    pad: 'sawtooth',
    lead: 'triangle',
    bright: 1200,
  },
  lagoon: {
    root: 53,
    scale: MAJOR,
    chords: [0, 3, 4, 5],
    bpm: 88,
    arp: 2,
    pad: 'triangle',
    lead: 'sine',
    bright: 1800,
  },
  canyon: {
    root: 48,
    scale: PENTA,
    chords: [0, 3, 1, 4],
    bpm: 80,
    arp: 2,
    pad: 'triangle',
    lead: 'triangle',
    bright: 1500,
  },
  caverns: {
    root: 43,
    scale: MINOR_PENTA,
    chords: [0, 2, 3, 1],
    bpm: 64,
    arp: 1,
    pad: 'sawtooth',
    lead: 'sine',
    bright: 700,
  },
  crystalSea: {
    root: 55,
    scale: LYDIAN,
    chords: [0, 1, 4, 2],
    bpm: 70,
    arp: 3,
    pad: 'sine',
    lead: 'sine',
    bright: 2400,
  },
  starDunes: {
    root: 46,
    scale: DORIAN,
    chords: [0, 4, 3, 6],
    bpm: 66,
    arp: 2,
    pad: 'sawtooth',
    lead: 'triangle',
    bright: 900,
  },
  floatingGardens: {
    root: 57,
    scale: MAJOR,
    chords: [0, 4, 5, 3],
    bpm: 92,
    arp: 2,
    pad: 'triangle',
    lead: 'sine',
    bright: 2000,
  },
  auroraVoid: {
    root: 47,
    scale: WHOLE,
    chords: [0, 2, 1, 3],
    bpm: 58,
    arp: 1,
    pad: 'sawtooth',
    lead: 'sine',
    bright: 800,
  },
} as const satisfies Record<string, Mood>

export type MoodName = keyof typeof MOODS

/** The frequency of a MIDI note. */
export function frequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

/** A note of the scale, counted in steps from the root; steps past the scale go up an octave. */
export function scaleNote(mood: Mood, step: number): number {
  const length = mood.scale.length
  const octave = Math.floor(step / length)
  const index = ((step % length) + length) % length
  return mood.root + octave * 12 + (mood.scale[index] ?? 0)
}

/** The notes of a chord on a scale degree: root, third and fifth of the scale. */
export function chordNotes(mood: Mood, degree: number): number[] {
  return [0, 2, 4].map((offset) => scaleNote(mood, degree + offset))
}
