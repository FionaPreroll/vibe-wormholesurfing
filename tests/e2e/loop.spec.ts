import { expect, test } from '@playwright/test'
import { openGame, walkToTreasure, warpInto } from './game'

test.use({ locale: 'en-US' })

test('rides into a hole, finds the treasure and keeps it in the collection', async ({ page }) => {
  // A whole ride and a world, drawn in software: this takes a while.
  test.setTimeout(150_000)
  await openGame(page)
  await page.getByRole('button', { name: 'Fly!' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  await warpInto(page, 'green', 3)

  await expect(page.getByText('The Canyon')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Find the treasure under the pillar of light')).toBeVisible({
    timeout: 10_000,
  })
  await walkToTreasure(page)
  const open = page.getByRole('button', { name: /Open the treasure/ })
  await expect(open).toBeVisible()
  await page.keyboard.press('KeyE')

  const card = page.getByRole('dialog')
  await expect(card.getByRole('button', { name: 'Fly again' })).toBeVisible({ timeout: 15_000 })
  await expect(card.getByText('New!')).toBeVisible()
  const name = await card.getByRole('heading').textContent()

  await card.getByRole('button', { name: 'Collection' }).click()
  await expect(page.getByText('1 of 40 treasures found')).toBeVisible()
  await expect(page.getByText(name ?? '')).toBeVisible()

  // The find survives a reload.
  await page.reload()
  await expect(page.getByText('Treasures: 1 of 40')).toBeVisible({ timeout: 30_000 })
})
