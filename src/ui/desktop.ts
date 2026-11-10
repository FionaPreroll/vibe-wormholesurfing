import { SOURCE_URL } from './links'

/** What the desktop app's preload (desktop/preload.cts) hands the page. */
export interface DesktopApp {
  /** Node's name for the system: 'win32', 'darwin' or 'linux'. */
  readonly platform: string
  /** Node's name for the processor the app was built for: 'x64' or 'arm64'. */
  readonly arch: string
  /** The newest desktop build's `version.json`, which the main process fetches from GitHub. */
  readonly latestBuild: () => Promise<unknown>
  /** Closes the game's window, which quits the app (desktop/main.cts). */
  readonly quit: () => void
}

/** The desktop app, when the page runs in it; in a browser and the Android app, nothing. */
export function desktopApp(): DesktopApp | undefined {
  return (globalThis as { wormholeDesktop?: DesktopApp }).wormholeDesktop
}

/** True inside the desktop app for Windows, macOS and Linux. */
export function isDesktop(): boolean {
  return desktopApp() !== undefined
}

/** The systems the desktop app is built for. */
export type DesktopSystem = 'windows' | 'mac' | 'linux'

/** The system's name as players know it. */
export const SYSTEM_NAMES: Readonly<Record<DesktopSystem, string>> = {
  windows: 'Windows',
  mac: 'macOS',
  linux: 'Linux',
}

/** The system of Node's name, as the desktop app's preload gives it. */
export function systemOfPlatform(platform: string): DesktopSystem | undefined {
  if (platform === 'win32') return 'windows'
  if (platform === 'darwin') return 'mac'
  if (platform === 'linux') return 'linux'
  return undefined
}

/**
 * The desktop system a browser runs on, where the desktop app could go; undefined on phones,
 * tablets and Chromebooks, which it is not made for. iPads call themselves Macs, but have a touch
 * screen.
 */
export function browserSystem(
  agent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  touchPoints: number = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
): DesktopSystem | undefined {
  if (/Android|iPhone|iPad|iPod|CrOS/i.test(agent)) return undefined
  if (/Windows/i.test(agent)) return 'windows'
  if (/Macintosh|Mac OS X/i.test(agent)) return touchPoints > 1 ? undefined : 'mac'
  if (/Linux|X11/i.test(agent)) return 'linux'
  return undefined
}

/** The release "Wormhole Surfing for desktop", which CI replaces with every build of main. */
export const DESKTOP_RELEASE = `${SOURCE_URL}/releases/tag/desktop-latest`
const DESKTOP_FILES = `${SOURCE_URL}/releases/download/desktop-latest/`

/** A file of the newest desktop build, by its name in the release (electron-builder.yml). */
function desktopFile(name: string): string {
  return `${DESKTOP_FILES}${name}`
}

/** The newest build's `version.json`: its build number and commit (released by ci.yml). */
export const DESKTOP_VERSION_URL = desktopFile('version.json')

/** What to download for one system: the file most players want, with a name for its button. */
export interface DesktopDownload {
  readonly url: string
  /** Which button it is, for its text: see `desktopDownloads`. */
  readonly kind: 'windows' | 'macArm' | 'macIntel' | 'linux'
}

/**
 * The downloads for a system: the installer on Windows, the disk image on macOS, for Apple
 * silicon and for Intel, and the AppImage on Linux. The release page has the archives too.
 */
export function desktopDownloads(system: DesktopSystem): readonly DesktopDownload[] {
  switch (system) {
    case 'windows':
      return [{ kind: 'windows', url: desktopFile('wormhole-surfing-win-x64.exe') }]
    case 'mac':
      return [
        { kind: 'macArm', url: desktopFile('wormhole-surfing-mac-arm64.dmg') },
        { kind: 'macIntel', url: desktopFile('wormhole-surfing-mac-x64.dmg') },
      ]
    case 'linux':
      return [{ kind: 'linux', url: desktopFile('wormhole-surfing-linux-x86_64.AppImage') }]
  }
}

/** The download that replaces the app running here: the same system, the same processor. */
export function updateDownload(app: DesktopApp): string {
  const system = systemOfPlatform(app.platform)
  if (system === undefined) return DESKTOP_RELEASE
  const downloads = desktopDownloads(system)
  const own = system === 'mac' && app.arch !== 'arm64' ? downloads[1] : downloads[0]
  return own?.url ?? DESKTOP_RELEASE
}
