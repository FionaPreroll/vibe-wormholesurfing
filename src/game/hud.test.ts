import { describe, expect, it } from 'vitest'
import { HUD_STEP_MS, nextRideHud, type RideHud } from './hud'

const riding: RideHud = {
  distance: 120,
  speed: 1.234,
  pull: 0,
  combo: 0,
  stunned: false,
  captured: false,
  warping: false,
  orbs: 3,
  sparks: 0,
  time: 12.3,
}

// A phone's log showed rides at 49 frames a second where a lower resolution did not help: the
// cockpit was set every frame, so the browser restyled and repainted it every frame.
describe('nextRideHud', () => {
  it('shows values as they are shown: the speed to a hundredth, the time to the second', () => {
    const shown = nextRideHud(riding, { ...riding, distance: 121 }, HUD_STEP_MS)
    expect(shown).toMatchObject({ distance: 121, speed: 1.23, time: 12 })
  })

  it('keeps the same object while nothing shown changes, so nothing is drawn again', () => {
    const shown = nextRideHud(riding, riding, HUD_STEP_MS)
    expect(nextRideHud(shown, { ...riding, speed: 1.2341, time: 12.9 }, 1000)).toBe(shown)
  })

  it('counts the light-years at most every step, but shows an orb at once', () => {
    const shown = nextRideHud(riding, riding, HUD_STEP_MS)
    expect(nextRideHud(shown, { ...riding, distance: 125 }, HUD_STEP_MS / 3)).toBe(shown)
    expect(nextRideHud(shown, { ...riding, distance: 125 }, HUD_STEP_MS).distance).toBe(125)
    const orb = nextRideHud(shown, { ...riding, orbs: 4, combo: 1 }, 1)
    expect(orb.orbs).toBe(4)
  })
})
