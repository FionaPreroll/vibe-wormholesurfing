import { defineConfig, devices } from '@playwright/test'

const port = 4173
// Containers with a preinstalled Chromium can point Playwright at it instead of its own download.
const executablePath = process.env.CHROMIUM_PATH

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  // Each test draws 3D in software; two at once on a CI runner starve each other.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}/`,
    trace: 'retain-on-failure',
  },
  // Every test draws 3D in software, which is slow: a little more patience than the default.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // A smaller picture draws faster in software.
        viewport: { width: 960, height: 540 },
        // WebGL without a graphics card: SwiftShader, which headless Chromium may not pick alone.
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
          ...(executablePath ? { executablePath } : {}),
        },
      },
    },
  ],
  webServer: {
    command: `pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
})
