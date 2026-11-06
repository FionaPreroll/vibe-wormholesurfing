import { describe, expect, it } from 'vitest'
import { frameKind } from './frames'

describe('frameKind', () => {
  it('tells a stall of the game from a pause of the browser', () => {
    expect(frameKind(1 / 60, true)).toBe('fine')
    expect(frameKind(0.4, true)).toBe('long')
    // A hidden page draws seldom by design.
    expect(frameKind(0.4, false)).toBe('fine')
    // A covered window on a Mac stops drawing while the page counts as visible: 9 s, 46 min.
    expect(frameKind(9.4, true)).toBe('paused')
    expect(frameKind(2793, true)).toBe('paused')
  })
})
