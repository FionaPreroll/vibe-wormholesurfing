import { afterEach, describe, expect, it } from 'vitest'
import { desktopApp, isDesktop } from './desktop'

const page = globalThis as { wormholeDesktop?: unknown }

describe('the desktop app', () => {
  afterEach(() => {
    delete page.wormholeDesktop
  })

  it('is told apart by what its preload hands the page, and only by that', () => {
    expect(isDesktop()).toBe(false)
    expect(desktopApp()).toBeUndefined()
    page.wormholeDesktop = { platform: 'linux' }
    expect(isDesktop()).toBe(true)
    expect(desktopApp()).toEqual({ platform: 'linux' })
  })
})
