import { expect, type Page, test } from '@playwright/test'
import { openGame, walkToTreasure, warpInto } from '../e2e/game'

/** Writes a picture of the README into docs/screenshots/. */
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/${name}.png` })

/** The time the ride or the world has run, in seconds of the game. */
const gameTime = () => {
  interface Stage {
    ride?: { time: number }
    expedition?: { time: number }
  }
  const stage = (window as unknown as { wormhole: { director: { stage?: Stage } } }).wormhole
    .director.stage
  return stage?.ride?.time ?? stage?.expedition?.time ?? 0
}

/**
 * Lets the game run on for this many of its own seconds. Where frames are slow, as with software
 * graphics, the game runs slower than the clock, and a wait by the clock would catch the flash of
 * an arrival or the camera still swooping in.
 */
async function play(page: Page, seconds: number): Promise<void> {
  const from = await page.evaluate(gameTime)
  await page.waitForFunction(`(${gameTime.toString()})() >= ${from + seconds}`, null, {
    timeout: 300_000,
  })
}

test.use({ viewport: { width: 1280, height: 720 }, locale: 'en-US' })
test.describe.configure({ timeout: 900_000 })

test('title, ride, world and treasure', async ({ page }) => {
  await openGame(page, 'high')
  await page.waitForTimeout(2500)
  await shot(page, 'title')
  await page.getByRole('button', { name: 'Fly!' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  await play(page, 6)
  await shot(page, 'ride')
  await warpInto(page, 'blue', 4)
  await expect(page.getByText('Find the treasure under the pillar of light')).toBeVisible({
    timeout: 120_000,
  })
  await page.getByRole('button', { name: 'Got it' }).click()
  await play(page, 4.5)
  await shot(page, 'world')
  await walkToTreasure(page)
  await play(page, 1)
  await page.keyboard.press('KeyE')
  await play(page, 1.4)
  await shot(page, 'opening')
  await expect(page.getByRole('button', { name: 'Fly again' })).toBeVisible({ timeout: 90_000 })
  await play(page, 1)
  await shot(page, 'reward')
})
