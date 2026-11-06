// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { bind, DEFAULT_BINDINGS } from './bindings'
import { PAD } from './gamepad'
import { Input } from './input'

/** A controller in the standard layout, as the browser reports it. */
function plugIn(axes: number[], pressed: number[] = []) {
  const buttons = Array.from({ length: 17 }, (_, index) => ({
    pressed: pressed.includes(index),
    touched: pressed.includes(index),
    value: pressed.includes(index) ? 1 : 0,
  }))
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: () => [{ id: 'Test pad', connected: true, mapping: 'standard', axes, buttons }],
  })
}

const key = (type: 'keydown' | 'keyup', code: string) =>
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }))

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
afterEach(() => {
  cleanup?.()
  plugIn([0, 0, 0, 0])
})

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

  it('does with a key what the bindings say', () => {
    const { input, detach } = setup()
    cleanup = detach
    input.mode = 'world'
    input.settings.bindings = bind(DEFAULT_BINDINGS, 'keys', 'confirm', 0, 'KeyJ')
    key('keydown', 'KeyJ')
    const frame = input.frame(1 / 60)
    expect(frame.confirm).toBe(true)
    // J turned the camera before; now it jumps only.
    expect(frame.look.x).toBe(0)
    key('keyup', 'KeyJ')
  })

  it('turns the camera with the arrows on foot and steers with them in flight', () => {
    const { input, detach } = setup()
    cleanup = detach
    input.mode = 'world'
    key('keydown', 'ArrowRight')
    const walking = input.frame(1 / 60)
    expect(walking.move.x).toBe(0)
    expect(walking.look.x).toBeGreaterThan(0)
    input.mode = 'ride'
    key('keydown', 'ArrowRight')
    expect(input.frame(1 / 60).move.x).toBeGreaterThan(0)
    key('keyup', 'ArrowRight')
  })

  it('swaps the camera up and down when asked, for sticks and keys alike', () => {
    const { input, detach } = setup()
    cleanup = detach
    input.mode = 'world'
    plugIn([0, 0, 0, -1])
    const plain = input.frame(1 / 60).look.y
    input.settings.invertLookY = true
    const inverted = input.frame(1 / 60).look.y
    expect(plain).not.toBe(0)
    expect(inverted).toBeCloseTo(-plain)
  })

  it('steers with the right stick when the sticks are swapped, as tuned', () => {
    const { input, detach } = setup()
    cleanup = detach
    input.mode = 'world'
    input.settings.sticks = { ...input.settings.sticks, swap: true }
    plugIn([0.9, 0, 0, 0])
    const frame = input.frame(1 / 60)
    expect(frame.move.x).toBe(0)
    expect(frame.look.x).toBeGreaterThan(0)
    input.settings.sticks = {
      move: { deadZone: 0.5, shape: 'round', sensitivity: 1 },
      look: input.settings.sticks.look,
      swap: true,
    }
    plugIn([0, 0, 0.4, 0])
    expect(input.frame(1 / 60).move.x).toBe(0)
    plugIn([0, 0, 0.9, 0])
    expect(input.frame(1 / 60).move.x).toBeGreaterThan(0)
  })

  it('takes bound controller buttons, and names the controller', () => {
    const { input, detach } = setup()
    cleanup = detach
    input.mode = 'world'
    input.settings.bindings = bind(DEFAULT_BINDINGS, 'pad', 'confirm', 0, PAD.rt)
    plugIn([0, 0, 0, 0], [PAD.rt])
    expect(input.frame(1 / 60).confirm).toBe(true)
    expect(input.padStyle.value).toBe('xbox')
  })
})
