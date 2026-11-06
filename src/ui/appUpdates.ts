import {
  AppUpdates,
  updateOnStart as onStart,
  type Release,
  type UpdateCheck,
} from '@fionapreroll/app-updates'
import { askAboutUpdates, type DialogOptions, offerUpdate } from '@fionapreroll/app-updates/dialog'
import { debugLog } from '../game/debugLog'
import { type Settings, settings } from '../game/settings'
import { locale, t } from '../i18n'
import { APK_NAME, RELEASE_FILES } from './links'
import { isApp } from './native'

/**
 * In-app updates for the Android app, from the release "Wormhole Surfing for Android", which CI
 * replaces with every build of main: `@fionapreroll/app-updates` does the work, with the release
 * named here and in capacitor.config.ts. Only in the app, and only when the player has switched
 * it on. In a browser the service worker brings new versions (see updates.ts).
 */

let made: AppUpdates | undefined

/** The game's updates, made when first needed. */
export function appUpdates(): AppUpdates {
  made ??= new AppUpdates({
    releases: RELEASE_FILES,
    apk: APK_NAME,
    log: (line) => debugLog.log('info', `Updates: ${line}`),
  })
  return made
}

/** The library's dialogs, in the player's language. */
function options(): DialogOptions {
  return { language: locale.value }
}

/** A newer build: download and install it now, or later. */
export function offer(release: Release, updates: AppUpdates = appUpdates()): void {
  offerUpdate(updates, release, t, options())
}

/** Looks for a newer build now, whatever the setting says. */
export function checkForUpdate(updates: AppUpdates = appUpdates()): Promise<UpdateCheck> {
  return updates.check()
}

/** The build number and version of the app installed, or undefined in a browser. */
export async function appBuild(
  updates: AppUpdates = appUpdates(),
): Promise<{ build: number; name: string } | undefined> {
  if (!isApp()) return undefined
  return (await updates.installed().catch(() => undefined)) ?? undefined
}

/**
 * At the app's start: asks once, at the first start, whether to look for updates (off unless the
 * player says yes), then looks if that is on, and offers what it finds. In a browser it does
 * nothing.
 */
export async function offerUpdatesOnStart(
  save: (changes: Partial<Settings>) => void,
  updates: AppUpdates = appUpdates(),
  inApp: boolean = isApp(),
): Promise<void> {
  if (!inApp) return
  await onStart(
    updates,
    {
      asked: () => settings.value.updatesAsked,
      enabled: () => settings.value.checkUpdates,
      answer: (yes) => save({ checkUpdates: yes, updatesAsked: true }),
    },
    {
      ask: () => askAboutUpdates(t, options()),
      offer: (release) => offer(release, updates),
    },
  )
}
