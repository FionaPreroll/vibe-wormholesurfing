import { mkdir, writeFile } from 'node:fs/promises'
import { type CDPSession, expect, type Page, test } from '@playwright/test'
import { openGame, walkToTreasure, warpInto, watchErrors } from '../e2e/game'
import { type Cycle, judge, type Measure, report } from './judge'

/**
 * The soak test: plays the game round after round for `SOAK_MINUTES` (20 by default), as a long
 * session would, through every world, the collection, the settings and the about page. Between
 * rounds, on the title screen, it measures what a leak would pile up: JavaScript memory after
 * garbage collection, the GPU's geometries, textures and shader programs, the page's elements
 * and event listeners. In the end `judge` compares the last rounds with the first, and the run
 * fails on errors, a lost WebGL context, or growth that would not stop. The measurements, a
 * summary and the game's debug log go to soak-report/.
 */

const MINUTES = Number(process.env.SOAK_MINUTES ?? 20)
const OUT = 'soak-report'
const COLORS = ['red', 'blue', 'green', 'yellow', 'white'] as const

test.use({ locale: 'en-US' })
test.describe.configure({ timeout: (MINUTES + 20) * 60_000 })

interface Debug {
  director: {
    diagnostics(): Record<string, unknown>
    stage?: { ride?: { time: number }; expedition?: { time: number } }
  }
  debugLog: {
    summary(): Record<string, unknown>
    entries: { kind: string; message: string }[]
    report(version: string): unknown
  }
}

/** What leaks would pile up, measured on the title screen after garbage collection. */
async function measure(page: Page, cdp: CDPSession): Promise<Measure> {
  // The title's stage shows once its shaders are ready, the world's playing until then: wait for
  // it, and then for two frames, as it uploads its geometry at its first draw, or a switch would
  // be measured half done.
  await page.waitForFunction(
    () =>
      (window as unknown as { wormhole: { director: { stage?: { ride?: { demo: boolean } } } } })
        .wormhole.director.stage?.ride?.demo === true,
  )
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  // Two passes: what the first frees can let more go.
  await cdp.send('HeapProfiler.collectGarbage')
  await cdp.send('HeapProfiler.collectGarbage')
  const { metrics } = await cdp.send('Performance.getMetrics')
  const metric = (name: string) => metrics.find((entry) => entry.name === name)?.value ?? 0
  const gpu = await page.evaluate(() => {
    const debug = (window as unknown as { wormhole: Debug }).wormhole
    const info = debug.director.diagnostics()
    const summary = debug.debugLog.summary()
    return {
      geometries: Number(info.geometries),
      textures: Number(info.textures),
      programs: Number(info.programs),
      quality: String(info.quality),
      glitches: Number(summary.glitches),
      errors: Number(summary.errors),
      contextLost: debug.debugLog.entries.some((entry) => /context lost/i.test(entry.message)),
      fps: Number(summary.fpsMedian),
    }
  })
  return {
    heapMB: Number((metric('JSHeapUsedSize') / 1048576).toFixed(1)),
    nodes: metric('Nodes'),
    listeners: metric('JSEventListeners'),
    documents: metric('Documents'),
    ...gpu,
  }
}

/** Lets the ride or the world run on for this many of its own seconds, or a minute at most. */
async function play(page: Page, seconds: number): Promise<void> {
  const time = () => {
    const stage = (window as unknown as { wormhole: Debug }).wormhole.director.stage
    return stage?.ride?.time ?? stage?.expedition?.time ?? 0
  }
  const from = await page.evaluate(time)
  await page
    .waitForFunction(`(${time.toString()})() >= ${from + seconds}`, null, { timeout: 60_000 })
    .catch(() => {})
}

/** Presses "Got it" on a first-time hint, if there is one. */
async function dismissHint(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Got it' })
    .click({ timeout: 4_000 })
    .catch(() => {})
}

/** One round: a ride with steering, a hole, a walk in the world, the treasure. */
async function round(page: Page, index: number): Promise<string> {
  await page.getByRole('button', { name: 'Fly!' }).click()
  if (index === 0) await dismissHint(page)
  await page.keyboard.down('ArrowLeft')
  await play(page, 1.5)
  await page.keyboard.up('ArrowLeft')
  await page.keyboard.down('ArrowRight')
  await play(page, 1.5)
  await page.keyboard.up('ArrowRight')
  await play(page, 2)
  await warpInto(page, COLORS[index % COLORS.length], 1 + (index % 4))
  await expect(page.getByText('Find the treasure under the pillar of light')).toBeVisible({
    timeout: 120_000,
  })
  if (index === 0) await dismissHint(page)
  const world = await page
    .locator('.cockpit-title span')
    .first()
    .textContent({ timeout: 10_000 })
    .catch(() => '')
  await page.keyboard.down('KeyW')
  await play(page, 1.5)
  await page.keyboard.up('KeyW')
  await walkToTreasure(page)
  await play(page, 0.5)
  await page.keyboard.press('KeyE')
  await expect(page.getByRole('button', { name: 'Fly again' })).toBeVisible({ timeout: 120_000 })
  return world?.trim() ?? ''
}

/** Every third round: the collection with a treasure up close, the settings and the about page. */
async function tour(page: Page, index: number): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name: 'Collection' }).click()
  // A treasure found so far: the slots of the others cannot be opened.
  await page.locator('.slot-button:not([disabled])').first().click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Back/ }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  // Switching the graphics rebuilds the passes: one way, then back the next time.
  await page
    .getByRole('dialog', { name: 'Settings' })
    .getByLabel('Graphics')
    .selectOption(index % 2 === 0 ? 'medium' : 'low')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'About' }).click()
  await expect(page.getByRole('heading', { name: 'Saved debug logs' })).toBeVisible()
  await page.getByRole('button', { name: /Back/ }).click()
}

test('plays round after round without leaking or failing', async ({ page }) => {
  const errors = watchErrors(page)
  await openGame(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const cycles: Cycle[] = []
  const started = Date.now()
  const deadline = started + MINUTES * 60_000
  cycles.push({ round: 0, minutes: 0, world: '', ...(await measure(page, cdp)) })

  for (let index = 0; Date.now() < deadline || cycles.length < 4; index++) {
    const world = await round(page, index)
    if (index % 3 === 2) await tour(page, index)
    else await page.getByRole('dialog').getByRole('button', { name: 'Title screen' }).click()
    await expect(page.getByRole('button', { name: 'Fly!' })).toBeVisible()
    const minutes = Number(((Date.now() - started) / 60_000).toFixed(1))
    const measured = await measure(page, cdp)
    cycles.push({ round: index + 1, minutes, world, ...measured })
    console.log(
      `round ${index + 1} at ${minutes} min, ${world}: ${measured.heapMB} MB heap, ` +
        `${measured.geometries} geometries, ${measured.textures} textures, ` +
        `${measured.programs} programs, ${measured.nodes} nodes, ${measured.listeners} listeners`,
    )
  }

  const verdict = judge(cycles, errors)
  await mkdir(OUT, { recursive: true })
  await writeFile(`${OUT}/cycles.json`, `${JSON.stringify({ cycles, verdict }, null, 2)}\n`)
  await writeFile(`${OUT}/summary.md`, report(cycles, verdict, MINUTES))
  const log = await page.evaluate(() =>
    (window as unknown as { wormhole: Debug }).wormhole.debugLog.report('soak'),
  )
  await writeFile(`${OUT}/debug-log.json`, `${JSON.stringify(log, null, 2)}\n`)
  expect(verdict.problems, verdict.problems.join('\n')).toEqual([])
})
