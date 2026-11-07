import type { Page } from '@playwright/test'
import { expect, test } from './coverage'
import { dismissHint, openGame, walkToTreasure, warpInto, watchErrors } from './game'

test.use({ locale: 'en-US' })

interface Debug {
  director: {
    stage?: {
      ride?: { demo: boolean; noseHitbox: boolean }
      expedition?: unknown
      hitboxesShown?: number
    }
  }
  debugLog: { entries: { kind: string; message: string }[] }
}

/** Waits until the stage on show is the title's, or a ride's. */
async function stageShows(page: Page, what: 'title' | 'ride'): Promise<void> {
  await page.waitForFunction(
    (demo) =>
      (window as unknown as { wormhole: Debug }).wormhole.director.stage?.ride?.demo === demo,
    what === 'title',
  )
}

/** How bright the game's picture is, from 0 to 255, read right after the game drew it. */
async function brightness(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        // A callback asked for now runs after the game's own in the next frame, while its picture
        // is still in the canvas.
        requestAnimationFrame(() => {
          const canvas = document.querySelector('canvas') as HTMLCanvasElement
          const copy = document.createElement('canvas')
          copy.width = 64
          copy.height = 36
          const context = copy.getContext('2d') as CanvasRenderingContext2D
          context.drawImage(canvas, 0, 0, 64, 36)
          const { data } = context.getImageData(0, 0, 64, 36)
          let sum = 0
          for (let index = 0; index < data.length; index += 4)
            sum +=
              ((data[index] as number) +
                (data[index + 1] as number) +
                (data[index + 2] as number)) /
              3
          resolve(sum / (data.length / 4))
        })
      }),
  )
}

// Switching to Ultra once left the picture black, and changing the resolution flashed it black.
test('switching the graphics quality keeps the picture', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = watchErrors(page)
  await openGame(page)
  await stageShows(page, 'title')
  for (const quality of ['Ultra', 'Low']) {
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByLabel('Graphics').selectOption({ label: quality })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1500)
    expect(await brightness(page)).toBeGreaterThan(8)
  }
  const black = await page.evaluate(() =>
    (window as unknown as { wormhole: Debug }).wormhole.debugLog.entries.filter((entry) =>
      /black|broken/i.test(entry.message),
    ),
  )
  expect(black).toEqual([])
  expect(errors).toEqual([])
})

test('dialogs fit the screen at twice their size, and the HUD grows from its corners', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openGame(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await dialog.getByRole('slider', { name: /Menu and dialog size/ }).fill('2')
  await expect(dialog.getByText('Menu and dialog size: 2.0×')).toBeVisible()
  const viewport = page.viewportSize() as { width: number; height: number }
  // The dialog rises into place as it opens: measured once it is there.
  await page
    .locator('.modal')
    .evaluate((element) =>
      Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    )
  const box = await page.locator('.modal').boundingBox()
  expect(box?.width).toBeGreaterThan(viewport.width * 0.8)
  expect((box?.x ?? -1) >= 0 && (box?.y ?? -1) >= 0).toBe(true)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width + 1)
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height + 1)
  await dialog.getByRole('slider', { name: /Menu and dialog size/ }).fill('1')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Fly!' }).click()
  await dismissHint(page)
  const cockpit = page.locator('.ride-hud .cockpit')
  await expect(cockpit).toBeVisible()
  const plain = (await cockpit.boundingBox()) as { width: number; x: number; y: number }
  await page.evaluate(() => document.documentElement.style.setProperty('--hud-scale', '2'))
  const twice = (await cockpit.boundingBox()) as { width: number; x: number; y: number }
  expect(twice.width / plain.width).toBeCloseTo(2, 1)
  // It grows from its corner, the bottom left, and stays on the screen.
  expect(twice.x).toBeGreaterThanOrEqual(0)
  expect(twice.y).toBeLessThan(plain.y)
})

test('the hitboxes show in a ride when asked, and go when not', async ({ page }) => {
  test.setTimeout(120_000)
  await openGame(page)
  const shown = () =>
    page.evaluate(
      () => (window as unknown as { wormhole: Debug }).wormhole.director.stage?.hitboxesShown ?? 0,
    )
  const atNose = () =>
    page.evaluate(
      () => (window as unknown as { wormhole: Debug }).wormhole.director.stage?.ride?.noseHitbox,
    )
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel(/Show hitboxes in rides/).check()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Fly!' }).click()
  await dismissHint(page)
  await stageShows(page, 'ride')
  // The field's edge and the ship at least, and what comes along.
  await expect.poll(shown).toBeGreaterThanOrEqual(2)
  // The ship's hitbox sits at the tip of its nose unless asked otherwise, even during a ride.
  expect(await atNose()).toBe(true)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel(/Show hitboxes in rides/).uncheck()
  await page.getByLabel(/hitbox for orbs and sparks at the tip of its nose/).uncheck()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect.poll(shown).toBe(0)
  await expect.poll(atNose).toBe(false)
})

test('a key bound anew does its new job in a ride', async ({ page }) => {
  test.setTimeout(120_000)
  await openGame(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Controller and keys' }).click()
  const dialog = page.getByRole('dialog', { name: 'Controller and keys' })
  const slot = dialog.getByRole('button', { name: /^Pause: Keyboard 1/ })
  await slot.click()
  await expect(slot).toHaveText('Press a key …')
  await page.keyboard.press('KeyQ')
  await expect(slot).toHaveText('Q')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Settings' })
    .getByRole('button', { name: 'Close', exact: true })
    .click()

  await page.getByRole('button', { name: 'Fly!' }).click()
  await dismissHint(page)
  await stageShows(page, 'ride')
  await page.keyboard.press('KeyQ')
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
})

test('the mouse pointer goes while the mouse rests in a ride, and comes back as it moves', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openGame(page)
  await page.getByRole('button', { name: 'Fly!' }).click()
  await dismissHint(page)
  await stageShows(page, 'ride')
  const cursor = () => page.evaluate(() => document.documentElement.dataset.cursor ?? 'shown')
  await page.mouse.move(400, 300)
  await page.mouse.move(420, 310)
  expect(await cursor()).toBe('shown')
  await expect.poll(cursor, { timeout: 10_000 }).toBe('hidden')
  await page.mouse.move(500, 320)
  expect(await cursor()).toBe('shown')
})

// The treasure once lay at the bottom of a slot in the Canyon; the opening camera ran into walls.
test('the treasure opens in view', async ({ page }) => {
  test.setTimeout(240_000)
  await openGame(page)
  await page.getByRole('button', { name: 'Fly!' }).click()
  await dismissHint(page)
  await warpInto(page, 'green', 2)
  await expect(page.getByText('Find the treasure under the pillar of light')).toBeVisible({
    timeout: 120_000,
  })
  await walkToTreasure(page)
  await page.keyboard.press('KeyE')
  // Once it has opened, the camera has swung round to its view: nothing stands between it and
  // the treasure.
  await expect(page.getByRole('button', { name: 'Fly again' })).toBeVisible({ timeout: 120_000 })
  const clear = await page.evaluate(() => {
    interface Stage {
      camera: { position: { x: number; y: number; z: number } }
      expedition: {
        treasure: { x: number; y: number; z: number }
        land: { heightAt(x: number, z: number): number }
      }
    }
    const stage = (window as unknown as { wormhole: { director: { stage: Stage } } }).wormhole
      .director.stage
    const from = stage.camera.position
    const to = stage.expedition.treasure
    for (let step = 1; step < 20; step++) {
      const t = step / 20
      const x = from.x + (to.x - from.x) * t
      const y = from.y + (to.y + 1 - from.y) * t
      const z = from.z + (to.z - from.z) * t
      if (stage.expedition.land.heightAt(x, z) > y) return false
    }
    return true
  })
  expect(clear).toBe(true)
})

// On phones the title screen ran at 34 frames a second where a ride ran at 50: its logo's moving
// colors had the browser paint it, with three glows, every frame, and a darkening layer over the
// whole page cost a blend of the whole screen at full resolution every frame.
test('below high quality the title screen paints nothing again from frame to frame', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openGame(page, 'medium')
  await stageShows(page, 'title')
  // The darkening is in the picture now, not a layer over the page.
  const background = await page
    .locator('.title-screen')
    .evaluate((element) => getComputedStyle(element).backgroundImage)
  expect(background).toBe('none')
  // Let the title screen's opening animations end, then count the browser's paints.
  await page.waitForTimeout(2000)
  const cdp = await page.context().newCDPSession(page)
  const events: { readonly [key: string]: string }[] = []
  cdp.on('Tracing.dataCollected', (data) => {
    events.push(...data.value)
  })
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline',
    transferMode: 'ReportEvents',
  })
  await page.waitForTimeout(2000)
  const done = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve))
  await cdp.send('Tracing.end')
  await done
  expect(events.filter((event) => event.name === 'Paint').length).toBeLessThanOrEqual(2)
  await cdp.detach()
})

// On a phone a ride stayed below 50 frames a second: the see-through ship's depth pass cost a
// fifth more draw calls, and the cockpit's gauge, animated on every change, was painted again
// with its glow every frame.
test('below high quality the ship is whole in a ride unless asked, and the cockpit holds still', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openGame(page, 'medium')
  const depthPasses = () =>
    page.evaluate(() => {
      let shown = 0
      const stage = (
        window as unknown as {
          wormhole: { director: { stage: { scene: { traverse(f: (o: unknown) => void): void } } } }
        }
      ).wormhole.director.stage
      stage.scene.traverse((object) => {
        const mesh = object as { name: string; visible: boolean }
        if (mesh.name === 'ghost-depth' && mesh.visible) shown++
      })
      return shown
    })
  await page.getByRole('button', { name: 'Fly!' }).click()
  await dismissHint(page)
  await stageShows(page, 'ride')
  await expect.poll(depthPasses).toBe(0)
  const gauge = page.locator('.gauge-fill')
  expect(await gauge.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s')
  expect(await gauge.evaluate((element) => getComputedStyle(element).filter)).toBe('none')

  // Asked for, the ship turns see-through.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('See-through ship in rides').selectOption('on')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect.poll(depthPasses).toBeGreaterThan(10)
})
