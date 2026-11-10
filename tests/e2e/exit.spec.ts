import type { Page } from '@playwright/test'
import { expect, test } from './coverage'
import { openGame } from './game'

test.use({ locale: 'en-US' })

/**
 * Makes the page see itself as the installed web app, in a window of its own without the
 * browser's bars. Chromium cannot be told so from outside, so the page's question is answered
 * before it loads.
 */
async function asInstalledApp(page: Page): Promise<void> {
  await page.context().addInitScript(() => {
    const ask = window.matchMedia.bind(window)
    window.matchMedia = (query) =>
      query.includes('display-mode: standalone')
        ? ({ ...ask('all'), matches: true, media: query } as MediaQueryList)
        : ask(query)
  })
}

test('a browser tab offers no Exit game: the tab is the browser’s', async ({ page }) => {
  await openGame(page)
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exit game' })).toHaveCount(0)
})

test('the web app installed on a computer closes its window with Exit game', async ({ page }) => {
  await asInstalledApp(page)
  // A page the window went to from another may not close it: no button that would do nothing.
  await openGame(page)
  await page.goto('./?debug&again')
  await page.waitForFunction(() => 'wormhole' in window, null, { timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exit game' })).toHaveCount(0)
  // As the installed app starts: a window whose first page is the game's.
  const opened = page.context().waitForEvent('page')
  await page.evaluate(() => window.open('./?debug', '_blank', 'popup'))
  const app = await opened
  await app.waitForFunction(() => 'wormhole' in window, null, { timeout: 30_000 })
  const closed = app.waitForEvent('close')
  await app.getByRole('button', { name: 'Exit game' }).click()
  await closed
})
