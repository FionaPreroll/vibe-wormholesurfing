// @vitest-environment happy-dom
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildGirl } from './girl'

/** How far behind its root the end of each twin tail and of the scarf hangs, along -z. */
function trailing(wind: number): number[] {
  const girl = buildGirl()
  // Long enough for the springs to settle.
  for (let frame = 0; frame < 300; frame++) girl.update(1 / 60, frame / 60, { mode: 'sit', wind })
  girl.group.updateMatrixWorld(true)
  const ends: [string, THREE.Vector3][] = [
    ['twin-tail', new THREE.Vector3(0, -0.62, 0)],
    ['scarf', new THREE.Vector3(-0.06, -0.2, -0.2)],
  ]
  const behind: number[] = []
  girl.group.traverse((object) => {
    for (const [name, end] of ends) {
      if (object.name !== name) continue
      const root = object.getWorldPosition(new THREE.Vector3())
      behind.push(root.z - object.localToWorld(end.clone()).z)
    }
  })
  girl.dispose()
  return behind
}

// In a ride the twin tails flew forward, in front of her face: the wind turned them the wrong
// way about their pivots.
describe('the girl in the wind', () => {
  it('streams her twin tails and scarf back, behind her, and farther in a stronger wind', () => {
    const still = trailing(0)
    // As in a ride at the starting speed (`src/view/ride/rideStage.ts`).
    const ride = trailing(0.6 + 1.2 * 0.5)
    expect(ride).toHaveLength(3)
    for (const [index, behind] of ride.entries()) {
      expect(behind).toBeGreaterThan(0.15)
      expect(behind).toBeGreaterThan((still[index] as number) + 0.05)
    }
  })
})
