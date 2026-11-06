import { devices, type Page } from '@playwright/test'
import { expect, test } from './coverage'
import { dismissHint, openGame, warpInto } from './game'

/** Waits until the stage on show is the title's, or a ride's. */
async function stageShows(page: Page, what: 'title' | 'ride'): Promise<void> {
  await page.waitForFunction(
    (demo) =>
      (window as unknown as { wormhole: { director: { stage?: { ride?: { demo: boolean } } } } })
        .wormhole.director.stage?.ride?.demo === demo,
    what === 'title',
  )
}

test.use({ locale: 'en-US' })

// Compiling alongside the frames needs KHR_parallel_shader_compile, as real browsers have.
test.use({
  launchOptions: {
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-angle-features=enableParallelCompileAndLink',
      '--enable-features=KHRParallelShaderCompile',
    ],
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  },
  ...devices['Desktop Chrome'],
  viewport: { width: 960, height: 540 },
})

// A log from Windows showed a 2.3 s first frame and a stall at every start of a ride: the
// stages built their shader programs in their first frame.
test('switching between the title, a ride and a world builds no shader inside a frame', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await page.addInitScript(() => {
    const state = { inFrame: false, links: [] as boolean[] }
    ;(window as unknown as { shaderLinks: typeof state }).shaderLinks = state
    const frame = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) =>
      frame((time) => {
        state.inFrame = true
        try {
          callback(time)
        } finally {
          state.inFrame = false
        }
      })
    const link = WebGL2RenderingContext.prototype.linkProgram
    WebGL2RenderingContext.prototype.linkProgram = function (program) {
      state.links.push(state.inFrame)
      return link.call(this, program)
    }
  })
  await openGame(page)
  await stageShows(page, 'title')
  const inFrame = () =>
    page.evaluate(() => {
      const state = (window as unknown as { shaderLinks: { links: boolean[] } }).shaderLinks
      const count = state.links.filter(Boolean).length
      state.links = []
      return count
    })
  // The last pass sets its shader up at its first frame; it is the smallest. Nothing else.
  await page.waitForTimeout(1500)
  expect(await inFrame()).toBeLessThanOrEqual(1)

  await page.getByRole('button', { name: 'Fly!' }).click()
  await dismissHint(page)
  await stageShows(page, 'ride')
  await page.waitForTimeout(3000)
  expect(await inFrame()).toBe(0)

  await warpInto(page, 'red', 4)
  await expect(page.getByText('Find the treasure under the pillar of light')).toBeVisible({
    timeout: 120_000,
  })
  await page.waitForTimeout(2000)
  expect(await inFrame()).toBe(0)
})
