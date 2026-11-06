/*
 * Renders the app icons from public/favicon.svg with Chromium: `pnpm icons`. They are the
 * website's, in public/icons/, and the Android app's launcher icons in android/app/src/main/res/.
 * Run it again after changing the favicon. CHROMIUM_PATH points it at an installed Chromium, as
 * for the Playwright tests.
 */
import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { chromium, type Page } from '@playwright/test'

const BACKGROUND = '#0a0618'
const RES = 'android/app/src/main/res'

interface Icon {
  readonly file: string
  /** Its size in pixels. */
  readonly size: number
  /** How much of it the favicon fills. */
  readonly fill: number
  /** A dark square behind it, for icons that may not be transparent. */
  readonly square?: boolean
  /** Cut to a circle, as Android's round icons are. */
  readonly round?: boolean
  /** Without the favicon's own rounded square, for Android's adaptive icon, which brings its own. */
  readonly bare?: boolean
}

/** The website's icons. */
const WEB: Icon[] = [
  { file: 'public/icons/icon-192.png', size: 192, fill: 1 },
  { file: 'public/icons/icon-512.png', size: 512, fill: 1 },
  // Launchers may cut a maskable icon to any shape; only its middle 80 % is sure to show.
  { file: 'public/icons/icon-maskable-512.png', size: 512, fill: 0.8, square: true },
  // iOS rounds the corners itself and would show transparent ones black.
  { file: 'public/icons/apple-touch-icon.png', size: 180, fill: 1, square: true },
]

/** Android's screen densities, as the scale of one dp. */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

/**
 * The Android app's: the adaptive icon's foreground on its grid of 108 dp, of which launchers
 * show at least the middle circle of 66 dp, over the sky of drawable/ic_launcher_background.xml;
 * and the square and round icons of 48 dp for launchers before Android 8.
 */
const ANDROID: Icon[] = Object.entries(DENSITIES).flatMap(([density, scale]) => [
  {
    file: `${RES}/mipmap-${density}/ic_launcher_foreground.png`,
    size: 108 * scale,
    fill: 0.72,
    bare: true,
  },
  { file: `${RES}/mipmap-${density}/ic_launcher.png`, size: 48 * scale, fill: 0.92 },
  {
    file: `${RES}/mipmap-${density}/ic_launcher_round.png`,
    size: 48 * scale,
    fill: 0.92,
    round: true,
  },
])

const favicon = await readFile('public/favicon.svg', 'utf8')
const source = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
const full = source(favicon)
const bare = source(favicon.replace(/<rect[^>]*\/>/, ''))

async function render(page: Page, icon: Icon): Promise<void> {
  const inner = Math.round(icon.size * icon.fill)
  const offset = (icon.size - inner) / 2
  await page.setViewportSize({ width: icon.size, height: icon.size })
  await page.setContent(
    `<body style="margin: 0; background: ${icon.square ? BACKGROUND : 'transparent'}">` +
      `<img src="${icon.bare ? bare : full}" style="position: absolute; left: ${offset}px; ` +
      `top: ${offset}px; width: ${inner}px; height: ${inner}px; ` +
      `border-radius: ${icon.round ? '50%' : '0'}"></body>`,
  )
  await page.locator('img').evaluate((image: HTMLImageElement) => image.decode())
  await mkdir(dirname(icon.file), { recursive: true })
  await page.screenshot({ path: icon.file, omitBackground: !icon.square })
  console.log(icon.file)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const page = await browser.newPage()
  for (const icon of [...WEB, ...ANDROID]) await render(page, icon)
} finally {
  await browser.close()
}
