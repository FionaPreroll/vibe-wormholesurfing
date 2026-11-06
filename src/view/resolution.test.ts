import { describe, expect, it } from 'vitest'
import { MIN_SCALE, RAISE_COOLDOWN, Resolution, TRIAL } from './resolution'

/** Plays `seconds` of frames at a frame rate `fps` that may follow the scale. */
function play(
  resolution: Resolution,
  start: number,
  seconds: number,
  fps: (scale: number) => number,
) {
  const changes = []
  let t = 0
  while (t < seconds) {
    const rate = fps(resolution.scale)
    const change = resolution.frame(1 / rate, start + t, rate)
    if (change) changes.push(change)
    t += 1 / rate
  }
  return changes
}

describe('Resolution', () => {
  it('lowers while frames come late, and keeps going down while that helps', () => {
    const resolution = new Resolution()
    // Each step down makes frames come quicker: 30, then 40, then 60 a second.
    const fps = (scale: number) => (scale >= 1 ? 30 : scale >= 0.88 ? 40 : 60)
    const changes = play(resolution, 0, 20, fps)
    expect(changes.map((change) => change.kind)).toEqual(['lowered', 'lowered'])
    expect(resolution.scale).toBe(0.76)
  })

  it('goes back up and stays there when lowering does not help, as on a phone', () => {
    const resolution = new Resolution()
    // A phone busy with other work: 40 frames a second, whatever the 3D view's resolution.
    const changes = play(resolution, 0, 30, () => 40)
    expect(changes.map((change) => change.kind)).toEqual(['lowered', 'kept'])
    expect(changes[1]).toMatchObject({ from: 0.88, to: 1, fps: 40, fpsBefore: 40 })
    expect(resolution.scale).toBe(1)
    expect(resolution.floor).toBe(1)
  })

  it('may try again on another screen, and after a new quality', () => {
    const resolution = new Resolution()
    play(resolution, 0, 2 + TRIAL, () => 40)
    expect(resolution.floor).toBe(1)
    resolution.newScreen()
    expect(resolution.floor).toBe(MIN_SCALE)
    resolution.scale = 0.7
    resolution.reset()
    expect(resolution.scale).toBe(1)
  })

  it('raises the resolution again once frames are quick, after a while', () => {
    const resolution = new Resolution()
    play(resolution, 0, 2, (scale) => (scale < 1 ? 60 : 30))
    expect(resolution.scale).toBe(0.88)
    const early = play(resolution, 2, RAISE_COOLDOWN - 4, () => 60)
    expect(early).toEqual([])
    const later = play(resolution, RAISE_COOLDOWN, 4, () => 60)
    expect(later.map((change) => change.kind)).toEqual(['raised'])
    expect(resolution.scale).toBe(0.96)
  })
})
