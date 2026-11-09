import { askAboutUpdates } from '@fionapreroll/app-updates/dialog'
import { signal } from '@preact/signals'
import { z } from 'zod'
import { debugLog } from '../game/debugLog'
import { type Settings, settings } from '../game/settings'
import { locale, t } from '../i18n'
import { type DesktopApp, desktopApp, updateDownload } from './desktop'

/**
 * Updates for the desktop app, from the release "Wormhole Surfing for desktop", which CI replaces
 * with every build of main. The app is not signed, so it cannot install a new version itself, as
 * the Android app does (appUpdates.ts): it only says that one is out, and Download opens it in
 * the browser, to install over this one. As in the Android app, it asks once at the first start
 * whether to look, and looks only if the player says yes.
 */

/**
 * This build's number: CI's run number (BUILD_NUMBER, see vite.config.ts). A build made by hand
 * has none and counts as 0, older than every release.
 */
export const DESKTOP_BUILD = Number.parseInt(import.meta.env.BUILD_NUMBER, 10) || 0

/** The newest build's `version.json`, as ci.yml writes it. */
const Latest = z.object({ build: z.number().int().positive(), commit: z.string().optional() })

/** What looking for a newer desktop build found. */
export type DesktopCheck =
  | { readonly kind: 'newer'; readonly build: number; readonly installed: number }
  | { readonly kind: 'current'; readonly installed: number }
  | { readonly kind: 'failed' }

/** Looks for a newer build than this one, through the main process, which fetches it. */
export async function checkDesktopUpdate(
  app: DesktopApp | undefined = desktopApp(),
  installed: number = DESKTOP_BUILD,
): Promise<DesktopCheck> {
  if (!app) return { kind: 'failed' }
  try {
    const latest = Latest.safeParse(await app.latestBuild())
    if (!latest.success) {
      debugLog.log('info', 'Updates: the newest version.json is not as expected')
      return { kind: 'failed' }
    }
    const { build } = latest.data
    debugLog.log('info', `Updates: the newest build is ${build}, this one is ${installed}`)
    return build > installed ? { kind: 'newer', build, installed } : { kind: 'current', installed }
  } catch (error) {
    // Most often there is no internet: the game plays on as it is.
    debugLog.log('info', `Updates: could not look: ${String(error)}`)
    return { kind: 'failed' }
  }
}

/** A newer build, until the player downloads it or puts it off (DesktopUpdateNotice). */
export const desktopUpdate = signal<number | undefined>(undefined)

/**
 * Opens the newest build's download for this system and processor in the browser (the main
 * process sends every new window there); it installs over this app, which keeps the save.
 */
export function downloadDesktopUpdate(app: DesktopApp | undefined = desktopApp()): void {
  if (!app) return
  window.open(updateDownload(app), '_blank')
  desktopUpdate.value = undefined
}

/**
 * At the desktop app's start: asks once, at the first start, whether to look for updates (off
 * unless the player says yes), then looks if that is on, and tells of what it finds. In a browser
 * and the Android app it does nothing.
 */
export async function offerDesktopUpdatesOnStart(
  save: (changes: Partial<Settings>) => void,
  app: DesktopApp | undefined = desktopApp(),
  ask: () => Promise<boolean> = () => askAboutUpdates(t, { language: locale.value }),
  check: () => Promise<DesktopCheck> = () => checkDesktopUpdate(app),
): Promise<void> {
  if (!app) return
  let enabled = settings.value.checkUpdates
  if (!settings.value.updatesAsked) {
    enabled = await ask()
    save({ checkUpdates: enabled, updatesAsked: true })
  }
  if (!enabled) return
  const found = await check()
  if (found.kind === 'newer') desktopUpdate.value = found.build
}
