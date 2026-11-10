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

  it('takes a late frame before the first picture for the game starting, not a stall', () => {
    // From a Windows log: 910 ms and 333 ms while the title was built, nothing drawn yet, and
    // 292 ms for the title's first drawing.
    expect(frameKind(0.91, true, false)).toBe('starting')
    expect(frameKind(0.292, true, false)).toBe('starting')
    // With software graphics the first drawing takes seconds: still the start, not a pause.
    expect(frameKind(3.3, true, false)).toBe('starting')
    expect(frameKind(1 / 60, true, false)).toBe('fine')
    expect(frameKind(0.4, false, false)).toBe('fine')
    // Once a picture shows, a late frame is a stall again.
    expect(frameKind(0.292, true, true)).toBe('long')
  })

  it('notes stalls from a tenth of a second, measured against the frames the device draws', () => {
    // From a Windows log at 144 frames a second: 194 ms in the Caverns as the treasure's card came
    // up, which went by without a line under the old quarter of a second.
    expect(frameKind(0.194, true, true, 0.0069)).toBe('long')
    expect(frameKind(0.09, true, true, 0.0069)).toBe('fine')
    // At 30 frames a second, a hitch of 120 ms is four frames: no stall worth a line yet.
    expect(frameKind(0.12, true, true, 1 / 30)).toBe('fine')
    expect(frameKind(0.15, true, true, 1 / 30)).toBe('long')
    // A device that draws eight frames a second all along is slow, not stalling at every frame.
    expect(frameKind(0.13, true, true, 0.125)).toBe('fine')
    expect(frameKind(0.6, true, true, 0.125)).toBe('long')
    // Before a second has been counted, a tenth of a second is the measure.
    expect(frameKind(0.11, true)).toBe('long')
  })
})
