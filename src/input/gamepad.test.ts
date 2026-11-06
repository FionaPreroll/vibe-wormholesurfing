import { describe, expect, it } from 'vitest'
import { padStyle } from './gamepad'

describe('padStyle', () => {
  it('tells PlayStation, Nintendo and other controllers apart by name and vendor', () => {
    expect(
      padStyle('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'),
    ).toBe('playstation')
    expect(padStyle('054c-09cc-Wireless Controller')).toBe('playstation')
    expect(padStyle('Wireless Controller (STANDARD GAMEPAD)')).toBe('playstation')
    expect(padStyle('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe(
      'nintendo',
    )
    expect(padStyle('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')).toBe(
      'xbox',
    )
    expect(padStyle('')).toBe('xbox')
  })
})
