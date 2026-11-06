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
})
