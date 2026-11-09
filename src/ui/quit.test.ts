// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DesktopApp } from './desktop'
import { quitGame, quitMethod } from './quit'

/** The page as an installed web app shows it, or in a browser tab. */
function displayMode(standalone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: standalone && query.includes('standalone'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

function userAgent(agent: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => agent })
}

const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/156.0'
const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/156.0'

const page = globalThis as { wormholeDesktop?: DesktopApp }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  userAgent('Mozilla/5.0 (X11; Linux x86_64)')
  delete page.wormholeDesktop
})

describe('leaving the game from its menu', () => {
  it('quits the desktop app through its main process', () => {
    displayMode(false)
    const quit = vi.fn()
    page.wormholeDesktop = { platform: 'win32', arch: 'x64', latestBuild: async () => ({}), quit }
    expect(quitMethod()).toBe('desktop')
    quitGame()
    expect(quit).toHaveBeenCalledOnce()
  })

  it('closes the window of the web app installed on a computer', () => {
    displayMode(true)
    userAgent(WINDOWS)
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    expect(quitMethod()).toBe('window')
    quitGame()
    expect(close).toHaveBeenCalledOnce()
  })

  it('is not offered in a browser tab, nor on a phone, nor where the window cannot close', () => {
    displayMode(false)
    userAgent(WINDOWS)
    expect(quitMethod()).toBeUndefined()
    // A page the window went to from another may not close it.
    displayMode(true)
    vi.spyOn(history, 'length', 'get').mockReturnValue(2)
    expect(quitMethod()).toBeUndefined()
    vi.restoreAllMocks()
    displayMode(true)
    userAgent(PHONE)
    expect(quitMethod()).toBeUndefined()
  })
})
