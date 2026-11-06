// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { Input } from './input'

function setup() {
  const element = document.createElement('div')
  document.body.append(element)
  element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 }) as DOMRect
  const input = new Input()
  const detach = input.attach(element)
  const move = (x: number, y: number, target: Element = element) =>
    target.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerType: 'mouse',
        clientX: x,
        clientY: y,
        bubbles: true,
      }),
    )
  return { element, input, detach, move }
}

let cleanup: (() => void) | undefined
afterEach(() => cleanup?.())

describe('Input', () => {
  it('ignores where the mouse rests when a ride starts', () => {
    const { input, detach, move } = setup()
    cleanup = detach
    // The pointer sits low on the screen, on the button that starts the ride.
    move(500, 560)
    input.mode = 'ride'
    move(503, 558)
    expect(input.frame(1 / 60).move).toEqual({ x: 0, y: 0 })
    expect(input.frame(1 / 60).source).not.toBe('mouse')
  })

  it('lets the mouse steer once it moves on purpose', () => {
    const { input, detach, move } = setup()
    cleanup = detach
    move(500, 300)
    input.mode = 'ride'
    move(900, 300)
    const frame = input.frame(1 / 60)
    expect(frame.source).toBe('mouse')
    expect(frame.move.x).toBeGreaterThan(0.5)
  })

  it('does not steer while the pointer moves over buttons', () => {
    const { element, input, detach, move } = setup()
    cleanup = detach
    const button = document.createElement('button')
    element.append(button)
    input.mode = 'ride'
    move(900, 500, button)
    expect(input.frame(1 / 60).source).not.toBe('mouse')
  })
})
