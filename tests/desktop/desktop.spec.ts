import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test'

/** The app as `pnpm desktop:pack` leaves it for this system, or the one WORMHOLE_DESKTOP_APP names. */
function packedApp(): string {
  if (process.env.WORMHOLE_DESKTOP_APP) return process.env.WORMHOLE_DESKTOP_APP
  const release = 'desktop/release'
  switch (process.platform) {
    case 'win32':
      return join(release, 'win-unpacked', 'Wormhole Surfing.exe')
    case 'darwin': {
      const folder = process.arch === 'arm64' ? 'mac-arm64' : 'mac'
      return join(release, folder, 'Wormhole Surfing.app', 'Contents', 'MacOS', 'Wormhole Surfing')
    }
    default:
      return join(release, 'linux-unpacked', 'wormhole-surfing')
  }
}

/** A line of the game's debug log (src/game/debugLog.ts). */
interface LogEntry {
  readonly kind: string
  readonly message: string
}

let userData: string

test.beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'wormhole-desktop-'))
})

test.afterEach(async () => {
  await rm(userData, { recursive: true, force: true })
})

/** Starts the packed app with a save folder of the test's own, and waits for the title screen. */
async function start(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await _electron.launch({
    executablePath: packedApp(),
    args: [
      '--lang=en-US',
      // As the browser tests: WebGL in software where there is no graphics chip, as on CI. Not on
      // macOS, where Chromium draws no WebGL in software on Apple silicon; the runners there have a
      // virtual graphics chip that Metal draws with.
      ...(process.platform === 'darwin' ? [] : ['--use-angle=swiftshader']),
      '--enable-unsafe-swiftshader',
      // Linux runners, and containers running as root, cannot set up Chromium's sandbox.
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
    env: { ...process.env, WORMHOLE_USER_DATA: userData },
  })
  const page = await app.firstWindow()
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text())
  })
  page.on('pageerror', (error) => problems.push(error.message))
  try {
    // Enabled once the 3D view has loaded, which fetches its files through the app's own origin.
    await expect(page.getByRole('button', { name: 'Fly!' })).toBeEnabled({ timeout: 90_000 })
  } catch (error) {
    // Why there is no game, in the log, where CI shows it: most often the graphics.
    const shown =
      (await page
        .locator('body')
        .textContent()
        .catch(() => null)) ?? ''
    const graphics = await app.evaluate(({ app }) => app.getGPUFeatureStatus())
    throw new Error(
      [
        `The title screen has no "Fly!" button. ${String(error)}`,
        `The page shows: ${shown.replace(/\s+/g, ' ').trim()}`,
        `It warned: ${problems.join(' | ') || 'nothing'}`,
        `Graphics: ${JSON.stringify(graphics)}`,
      ].join('\n'),
    )
  }
  return { app, page }
}

test('starts at the title screen, served from its own origin, without a service worker', async () => {
  const { app, page } = await start()
  expect(page.url()).toBe('app://wormhole/index.html')
  expect(
    await page.evaluate(
      () => (window as { wormholeDesktop?: { platform: string } }).wormholeDesktop,
    ),
  ).toEqual({ platform: process.platform })
  // Nothing of Node reaches the page.
  expect(await page.evaluate(() => typeof (window as { require?: unknown }).require)).toBe(
    'undefined',
  )
  // Again with the debug hook, whose log holds every warning and error since the page started:
  // there are none. A service worker the game tried to start would be one, as app:// has none to
  // give; the app's files are its own anyway.
  await page.goto('app://wormhole/index.html?debug')
  await page.waitForFunction(() => 'wormhole' in window, null, { timeout: 90_000 })
  const problems = await page.evaluate(() =>
    (
      window as unknown as { wormhole: { debugLog: { entries: LogEntry[] } } }
    ).wormhole.debugLog.entries
      .filter((entry) => entry.kind === 'warn' || entry.kind === 'error')
      .map((entry) => entry.message),
  )
  expect(problems).toEqual([])
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull()
  await app.close()
})

test('keeps the settings when it starts again', async () => {
  const first = await start()
  await first.page.getByRole('button', { name: 'Settings' }).click()
  await first.page.getByLabel('Show frames per second').check()
  await first.page.keyboard.press('Escape')
  // The save is written as the settings dialog closes.
  await first.page.waitForTimeout(1000)
  await first.app.close()

  const second = await start()
  await second.page.getByRole('button', { name: 'Settings' }).click()
  await expect(second.page.getByLabel('Show frames per second')).toBeChecked()
  await second.app.close()
})

test('opens links in the browser, never in its own window', async () => {
  const { app, page } = await start()
  await app.evaluate(({ shell }) => {
    const opened: string[] = []
    ;(globalThis as { opened?: string[] }).opened = opened
    shell.openExternal = async (url: string) => {
      opened.push(url)
    }
  })
  await page.evaluate(() => window.open('https://github.com/FionaPreroll/vibe-wormholesurfing'))
  await page.evaluate(() => {
    location.href = 'mailto:someone@example.com'
  })
  await expect
    .poll(() => app.evaluate(() => (globalThis as { opened?: string[] }).opened))
    .toEqual(['https://github.com/FionaPreroll/vibe-wormholesurfing', 'mailto:someone@example.com'])
  expect(app.windows()).toHaveLength(1)
  expect(page.url()).toBe('app://wormhole/index.html')
  await app.close()
})
