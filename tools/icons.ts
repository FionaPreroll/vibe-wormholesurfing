/*
 * Renders the app icons in public/icons/ from public/favicon.svg with Chromium: `pnpm icons`.
 * Run it again after changing the favicon. CHROMIUM_PATH points it at an installed Chromium, as
 * for the Playwright tests.
 */
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const BACKGROUND = '#0a0618'

/** Each icon's file, its size in pixels, and how much of it the favicon fills. */
const ICONS = [
  { file: 'icon-192.png', size: 192, fill: 1, square: false },
  { file: 'icon-512.png', size: 512, fill: 1, square: false },
  // Launchers may cut a maskable icon to any shape; only its middle 80 % is sure to show.
  { file: 'icon-maskable-512.png', size: 512, fill: 0.8, square: true },
  // iOS rounds the corners itself and would show transparent ones black.
  { file: 'apple-touch-icon.png', size: 180, fill: 1, square: true },
]

const svg = await readFile('public/favicon.svg')
const source = `data:image/svg+xml;base64,${svg.toString('base64')}`
await mkdir('public/icons', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage()
  for (const { file, size, fill, square } of ICONS) {
    const inner = Math.round(size * fill)
    const offset = (size - inner) / 2
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<body style="margin: 0; background: ${square ? BACKGROUND : 'transparent'}">` +
        `<img src="${source}" style="position: absolute; left: ${offset}px; top: ${offset}px; ` +
        `width: ${inner}px; height: ${inner}px"></body>`,
    )
    await page.locator('img').evaluate((image: HTMLImageElement) => image.decode())
    await page.screenshot({ path: `public/icons/${file}`, omitBackground: !square })
    console.log(`public/icons/${file}`)
  }
} finally {
  await browser.close()
}
