import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// The soak test: `pnpm test:soak` plays for SOAK_MINUTES (20 by default) and writes its
// measurements to soak-report/. See tests/soak/soak.spec.ts.
export default defineConfig({
  ...base,
  testDir: 'tests/soak',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results/soak',
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  retries: 0,
  workers: 1,
  use: {
    ...base.use,
    // A trace of a run this long would be hundreds of megabytes.
    trace: 'off',
    // A step that hangs fails within a minute, not at the end of the whole run.
    actionTimeout: 60_000,
  },
})
