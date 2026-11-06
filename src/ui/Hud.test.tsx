// @vitest-environment happy-dom
import { act, render } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../i18n'
import { PAD } from '../input/gamepad'
import { Input } from '../input/input'
import { HINT_MS, RideHud } from './Hud'

setLocale('en')

/** A controller whose buttons the test holds down. */
function plugIn(pressed: readonly number[]) {
  const buttons = Array.from({ length: 17 }, (_, index) => ({
    pressed: pressed.includes(index),
    touched: pressed.includes(index),
    value: pressed.includes(index) ? 1 : 0,
  }))
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: () => [
      { id: 'Test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons },
    ],
  })
}

function showHint() {
  const onHintSeen = vi.fn()
  const view = render(
    <RideHud
      input={new Input()}
      best={0}
      onPause={() => {}}
      onRecenter={() => {}}
      hint
      onHintSeen={onHintSeen}
    />,
  )
  return { onHintSeen, view }
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  })
  plugIn([])
})
afterEach(() => vi.useRealTimers())

describe('the ride hint', () => {
  it('goes by itself after a while', () => {
    const { onHintSeen, view } = showHint()
    expect(view.getByText('Surf the wormhole')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(HINT_MS - 100)
    })
    expect(onHintSeen).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onHintSeen).toHaveBeenCalledTimes(1)
  })

  it('goes at a single press of B, without a button to aim for', () => {
    const { onHintSeen } = showHint()
    act(() => {
      vi.advanceTimersByTime(50)
    })
    plugIn([PAD.b])
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(onHintSeen).toHaveBeenCalledTimes(1)
    // The timer that follows does not count it twice.
    act(() => {
      vi.advanceTimersByTime(HINT_MS)
    })
    expect(onHintSeen).toHaveBeenCalledTimes(1)
  })

  it('does not take a button that was already down when it showed', () => {
    plugIn([PAD.a])
    const { onHintSeen } = showHint()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(onHintSeen).not.toHaveBeenCalled()
  })

  it('goes with Enter or Space', () => {
    const { onHintSeen } = showHint()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    expect(onHintSeen).toHaveBeenCalledTimes(1)
  })
})
