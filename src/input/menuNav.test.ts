import { describe, expect, it } from 'vitest'
import { nearestInDirection } from './menuNav'

const box = (left: number, top: number) => ({ left, top, width: 100, height: 40 }) as DOMRect

describe('nearestInDirection', () => {
  const candidates = [
    { item: 'below', rect: box(0, 100) },
    { item: 'far below', rect: box(0, 300) },
    { item: 'right', rect: box(200, 0) },
    { item: 'below right', rect: box(150, 110) },
  ]

  it('picks the nearest element that lies the way asked', () => {
    expect(nearestInDirection(box(0, 0), candidates, 'down')).toBe('below')
    expect(nearestInDirection(box(0, 0), candidates, 'right')).toBe('right')
    expect(nearestInDirection(box(0, 0), candidates, 'up')).toBeUndefined()
  })
})
