import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Hitboxes } from './hitboxes'

describe('Hitboxes', () => {
  it('draws a circle at the size the rules test, and hides those a frame did not use', () => {
    const boxes = new Hitboxes()
    boxes.group.visible = true
    boxes.begin()
    boxes.circle('ship', 1, 2, 0, 0.85)
    boxes.circle('orb', 3, 0, -40, 0.8)
    boxes.end()
    expect(boxes.shown).toBe(2)
    const [ship, orb] = boxes.group.children as THREE.LineLoop[]
    expect(ship?.scale.x).toBeCloseTo(0.85)
    expect(ship?.position.toArray()).toEqual([1, 2, 0])
    expect(orb?.position.z).toBe(-40)
    boxes.begin()
    boxes.circle('ship', 0, 0, 0, 0.85)
    boxes.end()
    expect(boxes.shown).toBe(1)
    expect(orb?.visible).toBe(false)
    boxes.group.visible = false
    expect(boxes.shown).toBe(0)
    boxes.dispose()
  })
})
