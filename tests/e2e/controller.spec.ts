import type { Page } from '@playwright/test'
import { expect, test } from './coverage'
import { openGame } from './game'

test.use({ locale: 'en-US' })

/** A controller in the standard layout, whose buttons the test presses. */
async function plugInController(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pad = { buttons: new Array<number>(17).fill(0), axes: [0, 0, 0, 0] }
    ;(window as unknown as { pad: typeof pad }).pad = pad
    navigator.getGamepads = () =>
      [
        {
          id: 'Test controller',
          index: 0,
          connected: true,
          mapping: 'standard',
          timestamp: performance.now(),
          axes: [...pad.axes],
          buttons: pad.buttons.map((value) => ({
            pressed: value > 0.5,
            touched: value > 0,
            value,
          })),
          vibrationActuator: null,
        },
      ] as unknown as (Gamepad | null)[]
  })
}

/**
 * Presses a button for one frame of the game's polling and lets it go in the same frame: software
 * drawing makes frames slow, and a longer hold would repeat the press.
 */
async function press(page: Page, button: number): Promise<void> {
  await page.evaluate(
    (index) =>
      new Promise<void>((resolve) => {
        const { buttons } = (window as unknown as { pad: { buttons: number[] } }).pad
        buttons[index] = 1
        // The game polls in the next frame, before this callback, which comes after it.
        requestAnimationFrame(() => {
          buttons[index] = 0
          requestAnimationFrame(() => resolve())
        })
      }),
    button,
  )
}

const DOWN = 13
const LEFT = 14
const RIGHT = 15

/** A name for each control: its own, its label's or its text. */
const NAME = `(element) => element.getAttribute('aria-label') || element.closest('label')?.textContent?.trim() || element.textContent?.trim() || element.tagName`

test('a controller reaches every setting and changes sliders and lists', async ({ page }) => {
  await plugInController(page)
  await openGame(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog.getByRole('slider', { name: 'Sound effects' })).toBeVisible()

  const controls = await dialog.evaluate((root, name) => {
    const label = new Function(`return ${name}`)() as (element: Element) => string
    return [...root.querySelectorAll('button, input, select, a[href]')].map(label)
  }, NAME)
  const focused = () =>
    page.evaluate((name) => {
      const label = new Function(`return ${name}`)() as (element: Element) => string
      return document.activeElement ? label(document.activeElement) : ''
    }, NAME)
  const holdsValue = () =>
    page.evaluate(() => {
      const active = document.activeElement
      return active instanceof HTMLSelectElement || (active as HTMLInputElement).type === 'range'
    })

  // Down the dialog, and right along each row of buttons and back.
  const reached = new Set([await focused()])
  let last = ''
  for (let step = 0; step < controls.length * 2; step++) {
    await press(page, DOWN)
    const here = await focused()
    if (here === last) break
    last = here
    reached.add(here)
    if (await holdsValue()) continue
    await press(page, RIGHT)
    const beside = await focused()
    if (beside !== here) {
      reached.add(beside)
      await press(page, LEFT)
      expect(await focused()).toBe(here)
    }
  }
  expect(controls.filter((control) => !reached.has(control))).toEqual([])

  // Lists and sliders change with left and right.
  const graphics = dialog.getByLabel('Graphics')
  const before = await graphics.inputValue()
  await graphics.focus()
  await press(page, RIGHT)
  await expect(graphics).not.toHaveValue(before)
  const sound = dialog.getByRole('slider', { name: 'Sound effects' })
  await sound.focus()
  const volume = Number(await sound.inputValue())
  await press(page, LEFT)
  expect(Number(await sound.inputValue())).toBeLessThan(volume)
})
