import { expect, test } from './coverage'
import { openGame, watchErrors } from './game'

test.use({ locale: 'en-US' })

test('starts at the title screen without errors', async ({ page }) => {
  const errors = watchErrors(page)
  await openGame(page)
  await expect(page.getByRole('heading', { name: /Wormhole\s*Surfing/ })).toBeVisible()
  await expect(page.getByText('Treasures: 0 of 40')).toBeVisible()
  // The website keeps itself for offline play; only the Android app goes without.
  await expect
    .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())))
    .toBe(true)
  expect(errors).toEqual([])
})

test('flies a ride that counts light-years and pauses with Escape', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Fly!' }).click()
  await expect(page.getByRole('heading', { name: 'Surf the wormhole' })).toBeVisible()
  await page.getByRole('button', { name: 'Got it' }).click()
  // The distance is an LCD, a picture of digits labelled with its number.
  const distance = page.locator('.distance').getByRole('img', { name: /^light-years: / })
  await expect(distance).not.toHaveAttribute('aria-label', 'light-years: 0')
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(300)
  await page.keyboard.up('KeyD')
  await page.keyboard.press('Escape')
  const pause = page.getByRole('dialog', { name: 'Paused' })
  await expect(pause).toBeVisible()
  const before = await distance.getAttribute('aria-label')
  await page.waitForTimeout(500)
  expect(await distance.getAttribute('aria-label')).toBe(before)
  await pause.getByRole('button', { name: 'Resume' }).click()
  await expect(pause).toBeHidden()
})

test('opens the help and the settings from the title screen', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'How to play' }).click()
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Language').selectOption('de')
  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible()
})
