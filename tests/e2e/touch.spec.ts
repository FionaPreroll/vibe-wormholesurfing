import { devices } from '@playwright/test'
import { expect, test } from './coverage'
import { dismissHint, openGame, warpInto } from './game'

test.use({ ...devices['Pixel 7 landscape'], locale: 'en-US' })

test('plays on a phone held sideways, with a stick under the finger and a jump button', async ({
  page,
}) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Fly!' }).click()
  await dismissHint(page)
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

test('scrolls the help and the settings with a finger on a phone', async ({ page }) => {
  await openGame(page)
  const cdp = await page.context().newCDPSession(page)
  const swipeUp = async (x: number, y: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 10; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - step * 15 }],
      })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  for (const name of ['How to play', 'Settings']) {
    await page.getByRole('button', { name }).click()
    const body = page.locator('.modal-body')
    const viewport = page.viewportSize()
    // The dialog fits the screen once it has risen into place, and its body scrolls under a finger.
    await expect
      .poll(async () => {
        const rect = await body.boundingBox()
        return (rect?.y ?? 0) + (rect?.height ?? 0)
      })
      .toBeLessThanOrEqual(viewport?.height ?? 0)
    const box = await body.boundingBox()
    await swipeUp(
      Math.round((box?.x ?? 0) + (box?.width ?? 0) / 2),
      Math.round((box?.y ?? 0) + (box?.height ?? 0) * 0.8),
    )
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(20)
    await page.keyboard.press('Escape')
  }
})
