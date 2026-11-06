import { describe, expect, it } from 'vitest'
import { formatBytes, formatSeconds, lazyViewFiles } from './loading'

describe('formatBytes', () => {
  it('writes bytes, KiB and MiB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KiB')
    expect(formatBytes(200 * 1024)).toBe('200 KiB')
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MiB')
  })
})

describe('formatSeconds', () => {
  it('writes tenths of seconds, and minutes past one', () => {
    expect(formatSeconds(1234)).toBe('1.2 s')
    expect(formatSeconds(75_000)).toBe('1:15 min')
  })
})

describe('lazyViewFiles', () => {
  it('reads the list the build writes in, and nothing from the placeholder', () => {
    expect(lazyViewFiles('[{"file":"assets/director-1.js","bytes":700000}]')).toEqual([
      { file: 'assets/director-1.js', bytes: 700000 },
    ])
    expect(lazyViewFiles('__LAZY_VIEW_FILES__')).toEqual([])
    expect(lazyViewFiles('[broken')).toEqual([])
  })
})
