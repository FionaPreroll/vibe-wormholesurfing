import { devices, expect, test } from '@playwright/test'
import { openGame, warpInto } from './game'

test.use({ ...devices['Pixel 7 landscape'], locale: 'en-US' })

test('plays on a phone held sideways, with a stick under the finger and a jump button', async ({
  page,
}) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Fly!' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  await expect(page.getByText(/your finger/)).toBeHidden()

  // A finger on the screen brings up the stick.
  const box = page.locator('.game')
  await box.dispatchEvent('pointerdown', {
    pointerId: 7,
    pointerType: 'touch',
    clientX: 300,
    clientY: 200,
    isPrimary: true,
  })
  await expect(page.locator('.stick')).toBeVisible()
  await box.dispatchEvent('pointerup', {
    pointerId: 7,
    pointerType: 'touch',
    clientX: 300,
    clientY: 200,
    isPrimary: true,
  })
  await expect(page.locator('.stick')).toBeHidden()

  await warpInto(page, 'blue', 2)
  await expect(page.getByRole('button', { name: 'Jump' })).toBeVisible({ timeout: 60_000 })
})
