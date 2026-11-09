import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type Settings, settings } from '../game/settings'
import type { DesktopApp } from './desktop'
import {
  checkDesktopUpdate,
  type DesktopCheck,
  desktopUpdate,
  downloadDesktopUpdate,
  offerDesktopUpdatesOnStart,
} from './desktopUpdates'

/** The desktop app, with the newest build's version.json as the main process would fetch it. */
function app(latest: () => Promise<unknown>, platform = 'win32', arch = 'x64'): DesktopApp {
  return { platform, arch, latestBuild: latest }
}

afterEach(() => {
  settings.value = DEFAULT_SETTINGS
  desktopUpdate.value = undefined
  vi.unstubAllGlobals()
})

describe('looking for a newer desktop build', () => {
  it('finds one when the release’s build is newer than this one', async () => {
    const found = await checkDesktopUpdate(
      app(async () => ({ build: 72, commit: 'c6357a0' })),
      71,
    )
    expect(found).toEqual({ kind: 'newer', build: 72, installed: 71 })
  })

  it('finds none when this build is the release’s, or newer', async () => {
    expect(
      await checkDesktopUpdate(
        app(async () => ({ build: 71 })),
        71,
      ),
    ).toEqual({
      kind: 'current',
      installed: 71,
    })
    expect(
      await checkDesktopUpdate(
        app(async () => ({ build: 70 })),
        71,
      ),
    ).toEqual({
      kind: 'current',
      installed: 71,
    })
  })

  it('takes a build made by hand, build 0, for older than every release', async () => {
    expect(
      await checkDesktopUpdate(
        app(async () => ({ build: 1 })),
        0,
      ),
    ).toMatchObject({
      kind: 'newer',
    })
  })

  it('fails, and the game plays on, without internet or with a file not as expected', async () => {
    const offline = app(async () => {
      throw new Error('net::ERR_INTERNET_DISCONNECTED')
    })
    expect(await checkDesktopUpdate(offline, 71)).toEqual({ kind: 'failed' })
    expect(
      await checkDesktopUpdate(
        app(async () => ({ build: '72' })),
        71,
      ),
    ).toEqual({
      kind: 'failed',
    })
    expect(
      await checkDesktopUpdate(
        app(async () => 'Not Found'),
        71,
      ),
    ).toEqual({ kind: 'failed' })
    expect(await checkDesktopUpdate(undefined, 71)).toEqual({ kind: 'failed' })
  })
})

describe('the desktop app’s start', () => {
  /** Keeps what the start saves, as the game does. */
  function saver() {
    const saved: Partial<Settings>[] = []
    const save = (changes: Partial<Settings>) => {
      saved.push(changes)
      settings.value = { ...settings.value, ...changes }
    }
    return { saved, save }
  }
  const newer = async (): Promise<DesktopCheck> => ({ kind: 'newer', build: 99, installed: 71 })

  it('asks once, at the first start, and looks only if the player says yes', async () => {
    const { saved, save } = saver()
    const ask = vi.fn(async () => true)
    const check = vi.fn(newer)
    await offerDesktopUpdatesOnStart(
      save,
      app(async () => ({})),
      ask,
      check,
    )
    expect(ask).toHaveBeenCalledOnce()
    expect(saved).toEqual([{ checkUpdates: true, updatesAsked: true }])
    expect(check).toHaveBeenCalledOnce()
    expect(desktopUpdate.value).toBe(99)

    // At the next start it does not ask again, and looks again.
    desktopUpdate.value = undefined
    await offerDesktopUpdatesOnStart(
      save,
      app(async () => ({})),
      ask,
      check,
    )
    expect(ask).toHaveBeenCalledOnce()
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('does not look when the player said no', async () => {
    const { saved, save } = saver()
    const check = vi.fn(newer)
    await offerDesktopUpdatesOnStart(
      save,
      app(async () => ({})),
      async () => false,
      check,
    )
    expect(saved).toEqual([{ checkUpdates: false, updatesAsked: true }])
    expect(check).not.toHaveBeenCalled()
    expect(desktopUpdate.value).toBeUndefined()
  })

  it('shows nothing when this is the newest build, or looking failed', async () => {
    settings.value = { ...DEFAULT_SETTINGS, checkUpdates: true, updatesAsked: true }
    const { save } = saver()
    await offerDesktopUpdatesOnStart(
      save,
      app(async () => ({})),
      vi.fn(),
      async () => ({
        kind: 'current',
        installed: 71,
      }),
    )
    await offerDesktopUpdatesOnStart(
      save,
      app(async () => ({})),
      vi.fn(),
      async () => ({
        kind: 'failed',
      }),
    )
    expect(desktopUpdate.value).toBeUndefined()
  })

  it('does nothing outside the desktop app', async () => {
    const ask = vi.fn(async () => true)
    await offerDesktopUpdatesOnStart(() => {}, undefined, ask)
    expect(ask).not.toHaveBeenCalled()
  })
})

describe('downloading a newer desktop build', () => {
  it('opens the file for this system and processor, and puts the notice away', () => {
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    desktopUpdate.value = 99
    downloadDesktopUpdate(app(async () => ({}), 'darwin', 'arm64'))
    expect(open).toHaveBeenCalledWith(
      'https://github.com/FionaPreroll/vibe-wormholesurfing/releases/download/desktop-latest/wormhole-surfing-mac-arm64.dmg',
      '_blank',
    )
    expect(desktopUpdate.value).toBeUndefined()
  })
})
