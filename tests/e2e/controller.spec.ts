import type { Page } from '@playwright/test'
import { expect, test } from './coverage'
import { openGame } from './game'

test.use({ locale: 'en-US' })

/** A controller in the standard layout, whose buttons the test presses. */
async function plugInController(page: Page, id = 'Test controller'): Promise<void> {
  await page.addInitScript((padId) => {
    const pad = { buttons: new Array<number>(17).fill(0), axes: [0, 0, 0, 0] }
    ;(window as unknown as { pad: typeof pad }).pad = pad
    navigator.getGamepads = () =>
      [
        {
          id: padId,
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
  }, id)
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

const A = 0
const B = 1
const R2 = 7
const DOWN = 13
const LEFT = 14
const RIGHT = 15

/** A name for each control: its own, its label's or its text. */
const NAME = `(element) => element.getAttribute('aria-label') || element.closest('label')?.textContent?.trim() || element.textContent?.trim() || element.tagName`

test('a controller reaches every setting and changes sliders and lists', async ({ page }) => {
  // Every press waits for two frames of the title screen, which draws 3D in software.
  test.slow()
  await plugInController(page)
  await openGame(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog.getByRole('slider', { name: 'Sound effects' })).toBeVisible()
  // The dialog puts the focus on its Close button, where the walk starts.
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()

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

test('keys and controller buttons can be bound anew, named as the controller prints them', async ({
  page,
}) => {
  test.slow()
  await plugInController(page, 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)')
  await openGame(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Controller and keys' }).click()
  const dialog = page.getByRole('dialog', { name: 'Controller and keys' })
  // The dialog puts the focus on its Close button first.
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()

  // A PlayStation controller jumps with its cross.
  const jumpPad = dialog.getByRole('button', { name: /^Jump, open: Controller 1/ })
  await expect(jumpPad).toHaveText('✕')

  // Choosing the slot with the controller waits for the next button, and R2 goes in.
  await jumpPad.focus()
  await press(page, A)
  await expect(jumpPad).toHaveText('Press a button …')
  await press(page, R2)
  await expect(jumpPad).toHaveText('R2')
  // The menus have the controller back once R2 is up again: B goes back to the settings.
  await expect(async () => {
    await press(page, B)
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible({ timeout: 5_000 })
  }).toPass()

  // A key moves from the camera to jumping.
  await page.getByRole('button', { name: 'Controller and keys' }).click()
  const jumpKey = dialog.getByRole('button', { name: /^Jump, open: Keyboard 2/ })
  await jumpKey.click()
  await expect(jumpKey).toHaveText('Press a key …')
  await page.keyboard.press('KeyJ')
  await expect(jumpKey).toHaveText('J')
  await expect(dialog.getByRole('button', { name: /^Camera left: Keyboard 1/ })).toHaveText('←')
  await expect(dialog.getByRole('button', { name: /^Jump, open: Controller 1/ })).toHaveText('R2')

  // Back to the defaults.
  await dialog.getByRole('button', { name: 'Back to the defaults' }).click()
  await expect(jumpKey).toHaveText('—')
  await expect(dialog.getByRole('button', { name: /^Jump, open: Controller 1/ })).toHaveText('✕')
})

test('the title screen offers full screen in a browser, to a controller too', async ({ page }) => {
  await plugInController(page)
  await openGame(page)
  const button = page.getByRole('button', { name: 'Full screen' })
  await button.focus()
  await press(page, A)
  const leave = page.getByRole('button', { name: 'Leave full screen' })
  await expect(leave).toBeVisible()
  await expect(leave).toBeFocused()
  await press(page, A)
  await expect(button).toBeVisible()

  // Where a browser does not take a controller's press as the player's own, as Safari, the game
  // says what will do instead.
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = () =>
      Promise.reject(new TypeError('Permissions check failed'))
  })
  await button.focus()
  await press(page, A)
  await expect(page.getByText(/goes full screen only at a click/)).toBeVisible()
})
