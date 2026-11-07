import { describe, expect, it } from 'vitest'
import { stamp } from './download'

describe('stamp', () => {
  // Exports of one day all had the same name, and downloads piled up as "(1)", "(2)" and so on.
  it('names files by the local date and time to the second, without colons', () => {
    expect(stamp(new Date(2026, 10, 7, 4, 6, 27))).toBe('2026-11-07_04-06-27')
    expect(stamp(new Date(2026, 0, 2, 13, 0, 5))).toBe('2026-01-02_13-00-05')
  })
})
