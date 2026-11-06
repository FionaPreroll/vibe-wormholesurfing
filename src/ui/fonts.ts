import fredoka from '@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2?url'
import unbounded from '@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2?url'

/**
 * The game's two fonts, under the SIL Open Font License: Unbounded, wide and bold, for the logo
 * and headings, and Fredoka, rounded and easy to read, for everything else. Only their Latin
 * letters, which German needs too, are built in: about 80 KB, kept for offline play like every
 * file of the build. Until they have loaded, the system's font stands in.
 */
export const DISPLAY_FONT = 'Unbounded, Fredoka, system-ui, sans-serif'
export const TEXT_FONT = 'Fredoka, ui-rounded, system-ui, sans-serif'

const FACES = [
  { family: 'Unbounded', url: unbounded, weight: '200 900' },
  { family: 'Fredoka', url: fredoka, weight: '300 700' },
]

/** Adds the fonts to the page; resolves once both are there, or failed to load. */
export async function loadFonts(): Promise<void> {
  if (typeof FontFace === 'undefined' || !document.fonts) return
  const faces = FACES.map(
    ({ family, url, weight }) =>
      new FontFace(family, `url(${url}) format('woff2')`, { weight, display: 'swap' }),
  )
  for (const face of faces) document.fonts.add(face)
  await Promise.all(faces.map((face) => face.load().catch(() => undefined)))
}
