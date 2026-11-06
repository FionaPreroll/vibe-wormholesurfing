import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// The README's screenshots: `pnpm screenshots` writes them to docs/screenshots/.
export default defineConfig({
  ...base,
  testDir: 'tests/screenshots',
  outputDir: 'test-results/screenshots',
  reporter: 'list',
  timeout: 120_000,
})
