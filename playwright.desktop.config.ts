import { defineConfig } from '@playwright/test'

// The desktop app's smoke test: `pnpm test:desktop` packs the app for this system, unpacked, and
// starts it with Playwright. See tests/desktop/desktop.spec.ts.
export default defineConfig({
  testDir: 'tests/desktop',
  outputDir: 'test-results/desktop',
  forbidOnly: Boolean(process.env.CI),
  // One app at a time: each test starts and quits it.
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  // The game draws 3D in software on machines without a graphics chip, as CI's.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: { trace: 'retain-on-failure' },
})
