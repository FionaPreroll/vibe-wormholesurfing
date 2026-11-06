import { describe, expect, it } from 'vitest'
import { actionsForKey, bind, boundKeys, DEFAULT_BINDINGS, unbind } from './bindings'
import { PAD } from './gamepad'

describe('bindings', () => {
  it('steers with the arrow keys while flying and turns the camera with them on foot', () => {
    expect(actionsForKey(DEFAULT_BINDINGS, 'ArrowUp', 'ride')).toEqual(['moveUp'])
    expect(actionsForKey(DEFAULT_BINDINGS, 'ArrowUp', 'world')).toEqual(['lookUp'])
    expect(actionsForKey(DEFAULT_BINDINGS, 'KeyW', 'world')).toEqual(['moveUp'])
    expect(actionsForKey(DEFAULT_BINDINGS, 'Space', 'world')).toEqual(['confirm'])
    expect(actionsForKey(DEFAULT_BINDINGS, 'KeyQ', 'world')).toEqual([])
  })

  it('takes a key from the action that had it, so one press does one thing', () => {
    const next = bind(DEFAULT_BINDINGS, 'keys', 'confirm', 1, 'KeyE')
    expect(next.keys.confirm).toEqual(['Space', 'KeyE'])
    expect(next.keys.interact).toEqual(['Enter'])
    // The defaults stay as they were.
    expect(DEFAULT_BINDINGS.keys.interact).toEqual(['KeyE', 'Enter'])
  })

  it('lets a way to steer and the camera share a key, as the arrows do', () => {
    const next = bind(DEFAULT_BINDINGS, 'keys', 'lookUp', 0, 'KeyW')
    expect(next.keys.lookUp).toEqual(['KeyW', 'ArrowUp'])
    expect(next.keys.moveUp).toEqual(['KeyW', 'ArrowUp'])
    // Another direction gives it up.
    const down = bind(DEFAULT_BINDINGS, 'keys', 'lookDown', 0, 'KeyW')
    expect(down.keys.moveUp).toEqual(['ArrowUp'])
  })

  it('puts a key or button in place of what its slot held', () => {
    const next = bind(DEFAULT_BINDINGS, 'pad', 'confirm', 1, PAD.rt)
    expect(next.pad.confirm).toEqual([PAD.a, PAD.rt])
    const again = bind(next, 'pad', 'confirm', 0, PAD.lt)
    expect(again.pad.confirm).toEqual([PAD.lt, PAD.rt])
    // Moving a button to the other slot leaves no copy behind.
    expect(bind(again, 'pad', 'confirm', 0, PAD.rt).pad.confirm).toEqual([PAD.rt])
    expect(unbind(again, 'pad', 'confirm', 0).pad.confirm).toEqual([PAD.rt])
  })

  it('knows every key that does something', () => {
    const keys = boundKeys(DEFAULT_BINDINGS)
    expect(keys.has('Space')).toBe(true)
    expect(keys.has('KeyQ')).toBe(false)
  })
})
