import { expect, test } from './coverage'
import { openGame, walkToTreasure, warpInto, watchErrors } from './game'

test.use({ locale: 'en-US' })

test('rides into a hole, finds the treasure and keeps it in the collection', async ({ page }) => {
  // A whole ride and a world, drawn in software: this takes a while.
  test.setTimeout(360_000)
  await openGame(page)
  await page.getByRole('button', { name: 'Fly!' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  await warpInto(page, 'green', 3)

  await expect(page.getByText('The Canyon')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Find the treasure under the pillar of light')).toBeVisible({
    timeout: 30_000,
  })
  await walkToTreasure(page)
  const open = page.getByRole('button', { name: /Open the treasure/ })
  await expect(open).toBeVisible()
  await page.keyboard.press('KeyE')

  const card = page.getByRole('dialog')
  await expect(card.getByRole('button', { name: 'Fly again' })).toBeVisible({ timeout: 120_000 })
  await expect(card.getByText('New!')).toBeVisible()
  const name = await card.getByRole('heading').textContent()

  await card.getByRole('button', { name: 'Collection' }).click()
  await expect(page.getByText('1 of 40 treasures found')).toBeVisible()
  await expect(page.getByText(name ?? '')).toBeVisible()

  // The find survives a reload.
  await page.reload()
  await expect(page.getByText('Treasures: 1 of 40')).toBeVisible({ timeout: 60_000 })
})

test('leaving a ride during the warp drops the world being made ready', async ({ page }) => {
  test.setTimeout(240_000)
  const errors = watchErrors(page)
  await openGame(page)
  await page.getByRole('button', { name: 'Fly!' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  await warpInto(page, 'blue', 2)
  // At once, while the world behind the hole is still being built.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'End the ride' }).click()
  await expect(page.getByRole('button', { name: 'Fly!' })).toBeVisible()
  // Long enough for the dropped world to have finished building.
  await page.waitForTimeout(8_000)
  await expect(page.getByRole('button', { name: 'Fly!' })).toBeVisible()
  const stage = await page.evaluate(() => {
    const debug = (
      window as unknown as {
        wormhole: { director: { stage?: { expedition?: unknown; ride?: { demo: boolean } } } }
      }
    ).wormhole
    return {
      world: Boolean(debug.director.stage?.expedition),
      demo: debug.director.stage?.ride?.demo,
    }
  })
  expect(stage).toEqual({ world: false, demo: true })
  expect(errors).toEqual([])
})
