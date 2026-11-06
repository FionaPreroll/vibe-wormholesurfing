import { describe, expect, it } from 'vitest'
import { setLocale } from '../i18n'
import { bind, DEFAULT_BINDINGS } from '../input/bindings'
import { PAD } from '../input/gamepad'
import { buttonsFor, directionKeys, keyName, keysFor, padButtonName } from './controlNames'

setLocale('en')

describe('keyName', () => {
  it('names keys as they are printed on them', () => {
    expect(keyName('KeyW')).toBe('W')
    expect(keyName('Digit3')).toBe('3')
    expect(keyName('ArrowLeft')).toBe('←')
    expect(keyName('Space')).toBe('Space')
    expect(keyName('ShiftLeft')).toBe('left Shift')
    expect(keyName('NumpadAdd')).toBe('Num +')
    expect(keyName('Minus')).toBe('-')
  })
})

describe('padButtonName', () => {
  it('names buttons as the controller in hand prints them', () => {
    expect(padButtonName(PAD.a, 'xbox')).toBe('A')
    expect(padButtonName(PAD.a, 'playstation')).toBe('✕')
    expect(padButtonName(PAD.y, 'playstation')).toBe('△')
    expect(padButtonName(PAD.rt, 'playstation')).toBe('R2')
    // The bottom button of a Nintendo controller says B.
    expect(padButtonName(PAD.a, 'nintendo')).toBe('B')
    expect(padButtonName(PAD.up, 'xbox')).toBe('D-pad ↑')
    expect(padButtonName(20, 'xbox')).toBe('Button 20')
  })
})

describe('naming bindings', () => {
  it('says the keys of a way to move as players say them', () => {
    expect(directionKeys(DEFAULT_BINDINGS, 'move')).toBe('WASD or the arrow keys')
    expect(directionKeys(DEFAULT_BINDINGS, 'look')).toBe('IJKL or the arrow keys')
    const changed = bind(DEFAULT_BINDINGS, 'keys', 'moveUp', 0, 'Space')
    expect(directionKeys(changed, 'move')).toBe('Space/A/S/D or the arrow keys')
    const arrowsOnly = bind(DEFAULT_BINDINGS, 'keys', 'moveUp', 0, 'ArrowUp')
    expect(directionKeys(arrowsOnly, 'move')).toBe('↑ASD')
  })

  it('lists every key and button of an action', () => {
    expect(keysFor(DEFAULT_BINDINGS, 'interact')).toBe('E or Enter')
    expect(buttonsFor(DEFAULT_BINDINGS, 'confirm', 'playstation')).toBe('✕')
  })
})
