// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { adjustControl, nearestInDirection } from './menuNav'

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

  it('goes straight down from a wide box to a small one under its left end', () => {
    const wide = { left: 0, top: 0, width: 500, height: 40 } as DOMRect
    const tick = { item: 'tick', rect: { left: 0, top: 80, width: 20, height: 20 } as DOMRect }
    const button = {
      item: 'button',
      rect: { left: 150, top: 300, width: 200, height: 40 } as DOMRect,
    }
    expect(nearestInDirection(wide, [tick, button], 'down')).toBe('tick')
  })

  it('keeps left and right in the row', () => {
    const tick = { left: 0, top: 200, width: 20, height: 20 } as DOMRect
    const above = { item: 'above', rect: box(100, 100) }
    expect(nearestInDirection(tick, [above], 'right')).toBeUndefined()
    expect(
      nearestInDirection(tick, [above, { item: 'beside', rect: box(300, 190) }], 'right'),
    ).toBe('beside')
  })
})

describe('adjustControl', () => {
  it('moves a slider by a twentieth of its range at least, within its ends, as a person would', () => {
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '0'
    slider.max = '1'
    slider.step = '0.01'
    slider.value = '0.5'
    const seen: string[] = []
    slider.addEventListener('input', () => seen.push(`input ${slider.value}`))
    slider.addEventListener('change', () => seen.push('change'))
    expect(adjustControl(slider, 'right')).toBe(true)
    expect(seen).toEqual(['input 0.55', 'change'])
    slider.value = '0.98'
    adjustControl(slider, 'right')
    expect(slider.value).toBe('1')
  })

  it('steps through the choices of a list, around from the last to the first', () => {
    const list = document.createElement('select')
    for (const value of ['low', 'medium', 'high']) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = value
      list.append(option)
    }
    list.value = 'high'
    let changes = 0
    list.addEventListener('change', () => changes++)
    expect(adjustControl(list, 'right')).toBe(true)
    expect(list.value).toBe('low')
    adjustControl(list, 'left')
    expect(list.value).toBe('high')
    expect(changes).toBe(2)
  })

  it('leaves other controls to the focus', () => {
    expect(adjustControl(document.createElement('button'), 'left')).toBe(false)
    expect(adjustControl(null, 'right')).toBe(false)
  })
})
