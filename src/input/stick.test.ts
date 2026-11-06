import { describe, expect, it } from 'vitest'
import { FloatingStick, keysToVector, pointerSteer, shapeStick } from './stick'

describe('shapeStick', () => {
  it('ignores small leans and reaches full lean at the edge', () => {
    expect(shapeStick(0.1, 0)).toEqual({ x: 0, y: 0 })
    const full = shapeStick(1, 0)
    expect(full.x).toBeCloseTo(1)
    const diagonal = shapeStick(1, 1)
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1)
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
