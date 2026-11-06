import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'
import { lazyFiles } from './tools/lazyFiles.ts'
import { serviceWorker } from './tools/serviceWorker.ts'

export default defineConfig({
  // Relative asset URLs, so the build runs under any path, such as GitHub Pages' /vibe-wormholesurfing/.
  base: './',
  plugins: [preact(), lazyFiles(), serviceWorker()],
  build: {
    // three.js is one large chunk of its own, loaded once the first scene starts.
    chunkSizeWarningLimit: 1000,
    // Source maps only for measuring coverage in the browser tests (COVERAGE, see tests/e2e/coverage.ts).
    sourcemap: Boolean(process.env.COVERAGE),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts', 'tests/soak/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Every source file, so files without tests count as uncovered instead of missing.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}'],
      // lcov for Codecov, a table for the terminal.
      reporter: ['text', 'lcov'],
    },
  },
})
