import { expect, type Page, test } from '@playwright/test'
import { openGame, walkToTreasure, warpInto } from '../e2e/game'

/** Writes a picture of the README into docs/screenshots/. */
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/${name}.png` })

test.use({ viewport: { width: 1280, height: 720 }, locale: 'en-US' })
test.describe.configure({ timeout: 400_000 })

test('title, ride, world and treasure', async ({ page }) => {
  await openGame(page, 'high')
  await page.waitForTimeout(2500)
  await shot(page, 'title')
  await page.getByRole('button', { name: 'Fly!' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  // The mouse steers: back to the middle of the screen, so the ship flies straight on.
  await page.mouse.move(640, 300)
  await page.waitForTimeout(6000)
  await shot(page, 'ride')
  await warpInto(page, 'blue', 4)
  await expect(page.getByText('Find the treasure under the pillar of light')).toBeVisible({
    timeout: 120_000,
  })
  await page.getByRole('button', { name: 'Got it' }).click()
  await page.waitForTimeout(4000)
  await shot(page, 'world')
  await walkToTreasure(page)
  await page.waitForTimeout(800)
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(2000)
  await shot(page, 'opening')
  await expect(page.getByRole('button', { name: 'Fly again' })).toBeVisible({ timeout: 90_000 })
  await page.waitForTimeout(1000)
  await shot(page, 'reward')
})
