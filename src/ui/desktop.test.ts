import { afterEach, describe, expect, it } from 'vitest'
import {
  browserSystem,
  DESKTOP_RELEASE,
  type DesktopApp,
  desktopApp,
  desktopDownloads,
  isDesktop,
  systemOfPlatform,
  updateDownload,
} from './desktop'

const page = globalThis as { wormholeDesktop?: unknown }

/** The desktop app on a system, for a processor. */
function app(platform: string, arch = 'x64'): DesktopApp {
  return { platform, arch, latestBuild: async () => ({ build: 1 }) }
}

const FILES =
  'https://github.com/FionaPreroll/vibe-wormholesurfing/releases/download/desktop-latest/'

describe('the desktop app', () => {
  afterEach(() => {
    delete page.wormholeDesktop
  })

  it('is told apart by what its preload hands the page, and only by that', () => {
    expect(isDesktop()).toBe(false)
    expect(desktopApp()).toBeUndefined()
    const linux = app('linux')
    page.wormholeDesktop = linux
    expect(isDesktop()).toBe(true)
    expect(desktopApp()).toBe(linux)
  })

  it('knows its system by Node’s name for it', () => {
    expect(systemOfPlatform('win32')).toBe('windows')
    expect(systemOfPlatform('darwin')).toBe('mac')
    expect(systemOfPlatform('linux')).toBe('linux')
    expect(systemOfPlatform('freebsd')).toBeUndefined()
  })

  it('updates to the build for its own system and processor', () => {
    expect(updateDownload(app('win32'))).toBe(`${FILES}wormhole-surfing-win-x64.exe`)
    expect(updateDownload(app('darwin', 'arm64'))).toBe(`${FILES}wormhole-surfing-mac-arm64.dmg`)
    expect(updateDownload(app('darwin', 'x64'))).toBe(`${FILES}wormhole-surfing-mac-x64.dmg`)
    expect(updateDownload(app('linux'))).toBe(`${FILES}wormhole-surfing-linux-x86_64.AppImage`)
    // Somewhere it is not built for, the release page has every file.
    expect(updateDownload(app('freebsd'))).toBe(DESKTOP_RELEASE)
  })
})

describe('the desktop app’s downloads', () => {
  it('are the installer, the disk images and the AppImage', () => {
    expect(desktopDownloads('windows').map((download) => download.url)).toEqual([
      `${FILES}wormhole-surfing-win-x64.exe`,
    ])
    expect(desktopDownloads('mac').map((download) => download.kind)).toEqual(['macArm', 'macIntel'])
    expect(desktopDownloads('linux').map((download) => download.url)).toEqual([
      `${FILES}wormhole-surfing-linux-x86_64.AppImage`,
    ])
  })

  it('are offered on the desktop systems a browser runs on, and nowhere else', () => {
    const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/156.0'
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1'
    expect(browserSystem(windows, 0)).toBe('windows')
    expect(browserSystem(mac, 0)).toBe('mac')
    expect(browserSystem('Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0', 0)).toBe('linux')
    // iPads say they are Macs, but have a touch screen.
    expect(browserSystem(mac, 5)).toBeUndefined()
    expect(
      browserSystem('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/156.0', 5),
    ).toBeUndefined()
    expect(
      browserSystem('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5),
    ).toBeUndefined()
    expect(
      browserSystem('Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) Chrome/156.0', 0),
    ).toBeUndefined()
  })
})
