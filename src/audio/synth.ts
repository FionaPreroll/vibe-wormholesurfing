import type { GameEvent } from '../game/events'
import { chordNotes, frequency, MOODS, type Mood, type MoodName, scaleNote } from './music'

/** The steady sounds under a scene: wind through the wormhole, or a world's air, water or hum. */
export type Ambience = 'none' | 'ride' | 'wind' | 'water' | 'cave' | 'shimmer'

/**
 * Every sound of the game, made with the Web Audio API: effects from tones and noise, steady
 * ambience, and music generated bar by bar in the mood of the scene. Browsers start audio only
 * after a tap or a key, so nothing plays before `unlock`.
 */
export class Synth {
  #context: AudioContext | undefined
  #master: GainNode | undefined
  #sound: GainNode | undefined
  #music: GainNode | undefined
  #reverb: ConvolverNode | undefined
  #noise: AudioBuffer | undefined
  #volumes = { sound: 0.8, music: 0.55 }
  #mood: Mood = MOODS.title
  #moodName: MoodName = 'title'
  #timer: ReturnType<typeof setInterval> | undefined
  #nextBar = 0
  #bar = 0
  #ambience: { kind: Ambience; nodes: AudioNode[]; filter?: BiquadFilterNode; gain?: GainNode } = {
    kind: 'none',
    nodes: [],
  }
  #wantedAmbience: Ambience = 'none'
  #speed = 1
  #pull = 0

  get started(): boolean {
    return this.#context !== undefined
  }

  /** Silences everything while the game is hidden, as in the background on a phone. */
  sleep(): void {
    void this.#context?.suspend().catch(() => {})
  }

  /** Lets the sound go on after `sleep`. */
  wake(): void {
    if (this.#context?.state === 'suspended') void this.#context.resume().catch(() => {})
  }

  /** Starts audio; call it from a tap, click or key press. */
  unlock(): void {
    if (this.#context) {
      void this.#context.resume()
      return
    }
    const Context =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return
    const context = new Context()
    this.#context = context
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -14
    compressor.ratio.value = 4
    compressor.connect(context.destination)
    this.#master = context.createGain()
    this.#master.connect(compressor)
    this.#sound = context.createGain()
    this.#music = context.createGain()
    this.#sound.connect(this.#master)
    this.#music.connect(this.#master)
    this.#reverb = context.createConvolver()
    this.#reverb.buffer = this.#impulse(2.8)
    const wet = context.createGain()
    wet.gain.value = 0.32
    this.#reverb.connect(wet)
    wet.connect(this.#master)
    this.#noise = this.#makeNoise()
    this.#applyVolumes()
    this.#nextBar = context.currentTime + 0.1
    this.#timer = setInterval(() => this.#schedule(), 120)
    this.setAmbience(this.#wantedAmbience)
  }

  setVolumes(sound: number, music: number): void {
    this.#volumes = { sound, music }
    this.#applyVolumes()
  }

  #applyVolumes(): void {
    const context = this.#context
    if (!context || !this.#sound || !this.#music) return
    this.#sound.gain.setTargetAtTime(this.#volumes.sound * 0.9, context.currentTime, 0.05)
    this.#music.gain.setTargetAtTime(this.#volumes.music * 0.32, context.currentTime, 0.05)
  }

  setMood(name: MoodName): void {
    if (name === this.#moodName) return
    this.#moodName = name
    this.#mood = MOODS[name]
    this.#bar = 0
  }

  /** The ride's wind follows the ship's speed and the pull of holes. */
  setRide(speed: number, pull: number): void {
    this.#speed = speed
    this.#pull = pull
    const context = this.#context
    const { filter, gain, kind } = this.#ambience
    if (!context || kind !== 'ride' || !filter || !gain) return
    filter.frequency.setTargetAtTime(260 + speed * 700 + pull * 300, context.currentTime, 0.2)
    gain.gain.setTargetAtTime(0.05 + Math.min(1.5, speed) * 0.05, context.currentTime, 0.2)
  }

  setAmbience(kind: Ambience): void {
    this.#wantedAmbience = kind
    const context = this.#context
    if (!context || !this.#sound || !this.#noise) return
    if (this.#ambience.kind === kind) return
    const now = context.currentTime
    for (const node of this.#ambience.nodes) {
      if (node instanceof GainNode) node.gain.setTargetAtTime(0, now, 0.4)
      if (node instanceof AudioScheduledSourceNode) node.stop(now + 2)
    }
    this.#ambience = { kind, nodes: [] }
    if (kind === 'none') return
    const source = context.createBufferSource()
    source.buffer = this.#noise
    source.loop = true
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    gain.gain.value = 0
    const levels: Record<Exclude<Ambience, 'none'>, [BiquadFilterType, number, number, number]> = {
      ride: ['bandpass', 600, 0.7, 0.1],
      wind: ['lowpass', 500, 0.5, 0.07],
      water: ['bandpass', 900, 0.4, 0.06],
      cave: ['lowpass', 220, 0.8, 0.09],
      shimmer: ['highpass', 3200, 0.3, 0.02],
    }
    const [type, cutoff, q, level] = levels[kind]
    filter.type = type
    filter.frequency.value = cutoff
    filter.Q.value = q
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.#sound)
    gain.gain.setTargetAtTime(level, now, 0.8)
    source.start()
    const nodes: AudioNode[] = [source, filter, gain]
    // Slow swells: gusts of wind, rolling waves.
    if (kind === 'wind' || kind === 'water' || kind === 'shimmer') {
      const lfo = context.createOscillator()
      const depth = context.createGain()
      lfo.frequency.value = kind === 'water' ? 0.18 : 0.09
      depth.gain.value = kind === 'water' ? 380 : 260
      lfo.connect(depth)
      depth.connect(filter.frequency)
      lfo.start()
      nodes.push(lfo, depth)
    }
    if (kind === 'ride' || kind === 'cave') {
      const hum = context.createOscillator()
      hum.type = 'sawtooth'
      hum.frequency.value = kind === 'ride' ? 55 : 41
      const humFilter = context.createBiquadFilter()
      humFilter.type = 'lowpass'
      humFilter.frequency.value = 240
      const humGain = context.createGain()
      humGain.gain.value = 0
      humGain.gain.setTargetAtTime(kind === 'ride' ? 0.035 : 0.025, now, 1)
      hum.connect(humFilter)
      humFilter.connect(humGain)
      humGain.connect(this.#sound)
      hum.start()
      nodes.push(hum, humFilter, humGain)
    }
    this.#ambience = { kind, nodes, filter, gain }
  }

  /** Plays the sound of something that happened. */
  play(event: GameEvent): void {
    const context = this.#context
    if (!context) return
    const now = context.currentTime
    const mood = this.#mood
    switch (event.type) {
      case 'orb': {
        const step = Math.min(event.combo - 1, 10)
        const note = scaleNote(MOODS.ride, 14 + step)
        this.#tone('sine', frequency(note), frequency(note), 0.22, 0.13, now)
        this.#tone(
          'triangle',
          frequency(note + 12),
          frequency(note + 12),
          0.15,
          0.05,
          now + 0.03,
          true,
        )
        break
      }
      case 'spark':
        this.#burst(0.25, 0.32, 5000, 400, now)
        this.#tone('square', 900, 110, 0.28, 0.08, now)
        break
      case 'holeAppears': {
        const base = scaleNote(MOODS.ride, 7)
        for (let index = 0; index < event.tier; index++)
          this.#tone(
            'sine',
            frequency(base + index * 4),
            frequency(base + index * 4),
            0.9,
            0.04,
            now + index * 0.09,
            true,
          )
        break
      }
      case 'captured':
        this.#tone('sawtooth', 220, 70, 1.4, 0.07, now)
        this.#tone('sine', 110, 50, 1.6, 0.12, now)
        break
      case 'enter':
        this.#burst(1.8, 0.28, 300, 6000, now)
        for (let index = 0; index < 6; index++)
          this.#tone(
            'sine',
            frequency(scaleNote(MOODS.ride, 7 + index * 2)),
            frequency(scaleNote(MOODS.ride, 7 + index * 2)),
            0.9,
            0.06,
            now + 0.6 + index * 0.08,
            true,
          )
        break
      case 'arrive':
        this.#tone(
          'triangle',
          frequency(scaleNote(mood, 7)),
          frequency(scaleNote(mood, 7)),
          1.5,
          0.08,
          now,
          true,
        )
        this.#tone(
          'sine',
          frequency(scaleNote(mood, 11)),
          frequency(scaleNote(mood, 11)),
          1.8,
          0.06,
          now + 0.12,
          true,
        )
        break
      case 'jump':
        this.#tone('sine', 280, 620, 0.16, 0.12, now)
        break
      case 'land':
        this.#burst(0.08, 0.12, 900, 200, now)
        break
      case 'step':
        this.#burst(
          event.wet ? 0.12 : 0.05,
          event.wet ? 0.07 : 0.045,
          event.wet ? 2400 : 1600,
          event.wet ? 600 : 500,
          now,
        )
        break
      case 'open':
        for (let index = 0; index < 8; index++) {
          const note = frequency(scaleNote(mood, 7 + index))
          this.#tone('triangle', note, note, 0.4, 0.06, now + 0.6 + index * 0.16, true)
        }
        this.#burst(1.2, 0.08, 400, 4000, now + 0.4)
        break
      case 'reveal': {
        const steps = [0, 2, 4, 7, 9 + event.rarity]
        steps.forEach((step, index) => {
          const note = frequency(scaleNote(mood, 7 + step))
          this.#tone('triangle', note, note, 1.4, 0.09, now + index * 0.1, true)
          this.#tone('sine', note * 2, note * 2, 1.0, 0.03, now + index * 0.1, true)
        })
        if (event.shiny)
          for (let index = 0; index < 10; index++)
            this.#tone(
              'sine',
              2000 + index * 180,
              2400 + index * 200,
              0.15,
              0.025,
              now + 0.6 + index * 0.05,
              true,
            )
        break
      }
      case 'click':
        this.#tone('sine', 660, 880, 0.07, 0.05, now)
        break
    }
  }

  #tone(
    type: OscillatorType,
    from: number,
    to: number,
    seconds: number,
    gain: number,
    at: number,
    reverb = false,
  ): void {
    const context = this.#context
    if (!context || !this.#sound) return
    const oscillator = context.createOscillator()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, at)
    if (to !== from)
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + seconds)
    const envelope = context.createGain()
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(gain, at + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    oscillator.connect(envelope)
    envelope.connect(this.#sound)
    if (reverb && this.#reverb) envelope.connect(this.#reverb)
    oscillator.start(at)
    oscillator.stop(at + seconds + 0.05)
  }

  #burst(seconds: number, gain: number, from: number, to: number, at: number): void {
    const context = this.#context
    if (!context || !this.#sound || !this.#noise) return
    const source = context.createBufferSource()
    source.buffer = this.#noise
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(from, at)
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), at + seconds)
    const envelope = context.createGain()
    envelope.gain.setValueAtTime(gain, at)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(this.#sound)
    source.start(at, Math.random() * 1.5)
    source.stop(at + seconds + 0.05)
  }

  /** Schedules the music a little ahead: a pad chord per bar, a bass note and an arpeggio. */
  #schedule(): void {
    const context = this.#context
    if (!context || !this.#music) return
    while (this.#nextBar < context.currentTime + 0.6) {
      this.#playBar(this.#nextBar)
      this.#nextBar += (60 / this.#mood.bpm) * 4
      this.#bar++
    }
  }

  #playBar(at: number): void {
    const context = this.#context
    const out = this.#music
    if (!context || !out) return
    const mood = this.#mood
    const beat = 60 / mood.bpm
    const bar = beat * 4
    const degree = mood.chords[this.#bar % mood.chords.length] ?? 0
    const chord = chordNotes(mood, degree)
    // Pad: two detuned voices per note through a soft filter, swelling in and out.
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = mood.bright
    filter.Q.value = 0.6
    const pad = context.createGain()
    pad.gain.setValueAtTime(0, at)
    pad.gain.linearRampToValueAtTime(0.09, at + bar * 0.35)
    pad.gain.linearRampToValueAtTime(0.0001, at + bar * 1.05)
    filter.connect(pad)
    pad.connect(out)
    if (this.#reverb) pad.connect(this.#reverb)
    for (const note of chord) {
      for (const detune of [-7, 7]) {
        const voice = context.createOscillator()
        voice.type = mood.pad
        voice.frequency.value = frequency(note)
        voice.detune.value = detune
        const level = context.createGain()
        level.gain.value = mood.pad === 'sawtooth' ? 0.18 : 0.35
        voice.connect(level)
        level.connect(filter)
        voice.start(at)
        voice.stop(at + bar * 1.1)
      }
    }
    // Bass on the first beat.
    this.#musicTone('sine', frequency((chord[0] ?? mood.root) - 12), at, beat * 2.5, 0.16)
    // Arpeggio over the chord, a little different every bar.
    if (mood.arp > 0) {
      const count = 4 * mood.arp
      const step = beat / mood.arp
      for (let index = 0; index < count; index++) {
        if ((index * 7 + this.#bar * 3) % 5 === 4) continue
        const note = (chord[index % chord.length] ?? mood.root) + 12 + (index % 6 >= 3 ? 12 : 0)
        this.#musicTone(mood.lead, frequency(note), at + index * step, step * 1.6, 0.045)
      }
    }
  }

  #musicTone(type: OscillatorType, hz: number, at: number, seconds: number, gain: number): void {
    const context = this.#context
    const out = this.#music
    if (!context || !out) return
    const oscillator = context.createOscillator()
    oscillator.type = type
    oscillator.frequency.value = hz
    const envelope = context.createGain()
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(gain, at + 0.01)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    oscillator.connect(envelope)
    envelope.connect(out)
    if (this.#reverb) envelope.connect(this.#reverb)
    oscillator.start(at)
    oscillator.stop(at + seconds + 0.05)
  }

  #makeNoise(): AudioBuffer {
    const context = this.#context as AudioContext
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1
    return buffer
  }

  /** A room's echo, as noise that fades: enough for a sense of space. */
  #impulse(seconds: number): AudioBuffer {
    const context = this.#context as AudioContext
    const length = Math.floor(context.sampleRate * seconds)
    const buffer = context.createBuffer(2, length, context.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let index = 0; index < length; index++)
        data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2.6
    }
    return buffer
  }

  dispose(): void {
    clearInterval(this.#timer)
    void this.#context?.close()
    this.#context = undefined
  }

  /** For tests and the debug hook. */
  get state(): { speed: number; pull: number; mood: MoodName; ambience: Ambience } {
    return {
      speed: this.#speed,
      pull: this.#pull,
      mood: this.#moodName,
      ambience: this.#ambience.kind,
    }
  }
}
