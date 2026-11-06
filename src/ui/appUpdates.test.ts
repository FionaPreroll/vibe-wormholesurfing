// @vitest-environment happy-dom
import { AppUpdates } from '@fionapreroll/app-updates'
import { FakeUpdater } from '@fionapreroll/app-updates/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Settings, settings } from '../game/settings'
import { appBuild, offerUpdatesOnStart } from './appUpdates'
import { APK_NAME, RELEASE_FILES } from './links'

/** The game's updates with the native side played by the library's fake. */
function fake(): { native: FakeUpdater; updates: AppUpdates } {
  const native = new FakeUpdater()
  return { native, updates: new AppUpdates({ releases: RELEASE_FILES, apk: APK_NAME }, native) }
}

/** Keeps the player's answers as the save would. */
const keep = (changes: Partial<Settings>) => {
  settings.value = { ...settings.value, ...changes }
}

/** Presses a button of the update dialog on screen. */
function press(label: string): void {
  const button = [...document.querySelectorAll<HTMLButtonElement>('.modal.update button')].find(
    (candidate) => candidate.textContent === label,
  )
  if (!button) throw new Error(`No button ${label}`)
  button.click()
}

afterEach(() => {
  settings.value = DEFAULT_SETTINGS
  document.body.innerHTML = ''
})

describe('updates of the Android app', () => {
  it('do nothing in a browser', async () => {
    const { native, updates } = fake()
    await offerUpdatesOnStart(keep, updates, false)
    expect(native.calls).toEqual([])
    expect(document.querySelector('.modal.update')).toBeNull()
    expect(await appBuild(updates)).toBeUndefined()
  })

  it('ask once at the first start, and look for nothing unless the player says yes', async () => {
    const { native, updates } = fake()
    const start = offerUpdatesOnStart(keep, updates, true)
    await Promise.resolve()
    expect(document.querySelector('.modal.update h2')?.textContent).toBe('Updates')
    press('No')
    await start
    expect(settings.value).toMatchObject({ updatesAsked: true, checkUpdates: false })
    expect(native.count('fetchText')).toBe(0)

    // The next start asks no more.
    await offerUpdatesOnStart(keep, updates, true)
    expect(document.querySelector('.modal.update')).toBeNull()
  })

  it('offer a newer build when the player wants to hear of one', async () => {
    const { native, updates } = fake()
    settings.value = { ...DEFAULT_SETTINGS, updatesAsked: true, checkUpdates: true }
    await offerUpdatesOnStart(keep, updates, true)
    expect(native.calls).toContainEqual({
      method: 'fetchText',
      options: {
        url: 'https://github.com/FionaPreroll/vibe-wormholesurfing/releases/latest/download/version.json',
      },
    })
    expect(document.querySelector('.modal.update')?.textContent).toContain(
      'A new version of Wormhole Surfing is ready (build 7).',
    )
  })
})
