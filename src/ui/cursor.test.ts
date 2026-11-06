// @vitest-environment happy-dom
import { signal } from '@preact/signals-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Source } from '../input/input'
import { CURSOR_IDLE_MS, watchCursor } from './cursor'

const hidden = () => document.documentElement.dataset.cursor === 'hidden'
const moveMouse = () =>
  window.dispatchEvent(
    new PointerEvent('pointermove', { pointerType: 'mouse', movementX: 3, movementY: 1 }),
  )

let stop: (() => void) | undefined
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  stop?.()
  vi.useRealTimers()
})

describe('watchCursor', () => {
  it('hides the pointer when a controller or the keys take over, and shows it as the mouse moves', () => {
    const source = signal<Source>('mouse')
    stop = watchCursor(source, () => false)
    expect(hidden()).toBe(false)
    source.value = 'gamepad'
    expect(hidden()).toBe(true)
    moveMouse()
    expect(hidden()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(hidden()).toBe(true)
    // A modifier alone is no use of the keys.
    moveMouse()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(hidden()).toBe(false)
  })

  it('hides a resting pointer while playing, but not in the menus', () => {
    let playing = false
    stop = watchCursor(signal<Source>('mouse'), () => playing)
    moveMouse()
    vi.advanceTimersByTime(CURSOR_IDLE_MS + 100)
    expect(hidden()).toBe(false)
    playing = true
    moveMouse()
    vi.advanceTimersByTime(CURSOR_IDLE_MS - 100)
    expect(hidden()).toBe(false)
    vi.advanceTimersByTime(200)
    expect(hidden()).toBe(true)
  })

  it('says nothing about the source it starts with', () => {
    stop = watchCursor(signal<Source>('keyboard'), () => false)
    expect(hidden()).toBe(false)
  })
})
