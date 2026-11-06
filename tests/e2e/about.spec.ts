import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { openGame } from './game'

test.use({ locale: 'en-US' })

test('shows the about page with the changelog and exports the debug log', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'About' }).click()
  await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Changes' })).toBeVisible()
  await expect(page.getByText(/Ride a cute spaceship|ride a cute spaceship/).first()).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export debug log' }).click(),
  ])
  const report = JSON.parse(await readFile((await download.path()) as string, 'utf8'))
  expect(report.format).toBe('vibe-wormholesurfing-debug-log')
  expect(report.environment.gpuRenderer).toBeTruthy()
  expect(report.entries.map((entry: { message: string }) => entry.message)).toContain(
    'Showing title',
  )
})

test('exports the save and imports it again', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'About' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export save' }).click(),
  ])
  const text = await readFile((await download.path()) as string, 'utf8')
  const file = JSON.parse(text)
  expect(file.format).toBe('vibe-wormholesurfing-save')
  // A save with one treasure found, as if from another browser.
  file.save.collection = { tidePearl: { count: 2, shiny: 1, first: 1 } }
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByText('Import save').setInputFiles({
    name: 'save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  })
  await expect(page.getByText('The save was imported.')).toBeVisible()
  await page.getByRole('button', { name: /Back/ }).click()
  await expect(page.getByText('Treasures: 1 of 40')).toBeVisible()
})
