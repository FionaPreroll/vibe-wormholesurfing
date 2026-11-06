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
})

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
})
