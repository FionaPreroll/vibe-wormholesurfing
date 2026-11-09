// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../i18n'
import { WebAndApp } from './AboutScreen'

setLocale('en')

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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  userAgent('Mozilla/5.0 (X11; Linux x86_64)')
  delete (globalThis as { wormholeDesktop?: unknown }).wormholeDesktop
})

const FILES =
  'https://github.com/FionaPreroll/vibe-wormholesurfing/releases/download/desktop-latest/'

describe('WebAndApp', () => {
  it('in a browser tab, offers the Android app and installing', () => {
    displayMode(false)
    const view = render(<WebAndApp />)
    expect(view.getByText('You are playing in the browser.')).toBeTruthy()
    expect(view.getByRole('heading', { name: 'Install as an app' })).toBeTruthy()
  })

  it('as an installed web app, says so and how it updates', () => {
    displayMode(true)
    const view = render(<WebAndApp />)
    expect(view.getByText(/the web app your browser installed/)).toBeTruthy()
    expect(view.queryByText(/Android app/)).toBeNull()
    expect(view.getByRole('link', { name: 'Open the web version' })).toBeTruthy()
  })

  it('as an installed web app on Android, offers the Android app too', () => {
    displayMode(true)
    userAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')
    const view = render(<WebAndApp />)
    expect(view.getByText(/the web app your browser installed/)).toBeTruthy()
    expect(view.getByText(/an app of its own/)).toBeTruthy()
  })

  it('in a browser tab on a computer, offers the desktop app for its system', () => {
    displayMode(false)
    userAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/156.0')
    const view = render(<WebAndApp />)
    expect(view.getByRole('heading', { name: 'Desktop app' })).toBeTruthy()
    const download = view.getByRole('link', { name: 'Download for Windows' })
    expect(download.getAttribute('href')).toBe(`${FILES}wormhole-surfing-win-x64.exe`)
    expect(view.getByText(/choose More info, then Run anyway/)).toBeTruthy()
    // The Android app and installing stay on offer.
    expect(view.getByRole('heading', { name: 'Android app' })).toBeTruthy()
  })

  it('on a Mac, offers the build for Apple silicon and the one for Intel', () => {
    displayMode(false)
    userAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1')
    const view = render(<WebAndApp />)
    expect(
      view.getByRole('link', { name: 'Download for Mac with Apple silicon' }).getAttribute('href'),
    ).toBe(`${FILES}wormhole-surfing-mac-arm64.dmg`)
    expect(
      view.getByRole('link', { name: 'Download for Mac with Intel' }).getAttribute('href'),
    ).toBe(`${FILES}wormhole-surfing-mac-x64.dmg`)
  })

  it('on Android, offers no desktop app', () => {
    displayMode(false)
    userAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')
    const view = render(<WebAndApp />)
    expect(view.queryByRole('heading', { name: 'Desktop app' })).toBeNull()
  })

  it('in the desktop app, names its system and where its builds are, and offers no installing', () => {
    displayMode(false)
    ;(globalThis as { wormholeDesktop?: unknown }).wormholeDesktop = {
      platform: 'darwin',
      arch: 'arm64',
      latestBuild: async () => ({ build: 1 }),
    }
    const view = render(<WebAndApp />)
    expect(view.getByText(/the desktop app for macOS/)).toBeTruthy()
    // A build made by hand, as in this test, has no number.
    expect(view.getByText('A build made by hand, not by CI')).toBeTruthy()
    expect(view.getByRole('link', { name: 'Release page with every file' })).toBeTruthy()
    expect(view.getByRole('link', { name: 'Open the web version' })).toBeTruthy()
    expect(view.queryByText('You are playing in the browser.')).toBeNull()
    expect(view.queryByRole('heading', { name: 'Install as an app' })).toBeNull()
    expect(view.queryByRole('heading', { name: 'Android app' })).toBeNull()
  })
})
