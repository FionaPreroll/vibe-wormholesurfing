import { describe, expect, it } from 'vitest'
import { FloatingStick, keysToVector, pointerSteer, shapeStick, tuneStick } from './stick'

describe('shapeStick', () => {
  it('ignores small leans and reaches full lean at the edge', () => {
    expect(shapeStick(0.1, 0)).toEqual({ x: 0, y: 0 })
    const full = shapeStick(1, 0)
    expect(full.x).toBeCloseTo(1)
    const diagonal = shapeStick(1, 1)
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1)
  })

  it('takes the dead zone off each axis on its own with a cross', () => {
    // Nearly straight up comes out straight up, where a round dead zone keeps the slant.
    const cross = shapeStick(0.1, 0.9, 0.15, 1, 'cross')
    expect(cross.x).toBe(0)
    expect(cross.y).toBeCloseTo((0.9 - 0.15) / 0.85)
    expect(shapeStick(0.1, 0.9, 0.15, 1, 'round').x).toBeGreaterThan(0)
  })

  it('counts a push along one axis at once with a square', () => {
    expect(shapeStick(0.12, 0.12, 0.15, 1, 'square')).toEqual({ x: 0, y: 0 })
    // Round sees the length, which is past the dead zone already.
    expect(shapeStick(0.12, 0.12, 0.15, 1, 'round').x).toBeGreaterThan(0)
    const pushed = shapeStick(0.5, 0.1, 0.15, 1, 'square')
    expect(pushed.x).toBeGreaterThan(0)
    expect(pushed.y).toBeGreaterThan(0)
    expect(shapeStick(1, 0, 0.15, 1, 'square').x).toBeCloseTo(1)
  })
})

describe('tuneStick', () => {
  const tuning = { deadZone: 0.1, shape: 'round', sensitivity: 2 } as const

  it('answers more strongly when more sensitive, stopping at full lean where it steers', () => {
    const steer = tuneStick({ x: 0.55, y: 0 }, tuning, 1, true)
    expect(steer.x).toBeCloseTo(1)
    const look = tuneStick({ x: 1, y: 0 }, tuning, 1, false)
    expect(look.x).toBeCloseTo(2)
  })
})

describe('keysToVector', () => {
  it('moves no faster on diagonals', () => {
    const diagonal = keysToVector(true, false, false, true)
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1)
    expect(keysToVector(true, true, false, false)).toEqual({ x: 0, y: 0 })
  })
})

describe('FloatingStick', () => {
  it('leans with the finger, up positive, and drags its middle along', () => {
    const stick = new FloatingStick(100, 100, 50)
    stick.move(100, 50)
    expect(stick.value.y).toBeCloseTo(1)
    stick.move(100, 0)
    expect(stick.originY).toBe(50)
    stick.move(100, 50)
    expect(stick.value.y).toBeCloseTo(0)
  })
})

describe('pointerSteer', () => {
  it('steers by where the pointer is from the middle', () => {
    expect(pointerSteer(500, 300, 1000, 600)).toEqual({ x: 0, y: 0 })
    const right = pointerSteer(1000, 300, 1000, 600)
    expect(right.x).toBeCloseTo(1)
    const up = pointerSteer(500, 0, 1000, 600)
    expect(up.y).toBeCloseTo(1)
  })
})
