import { ITEMS, RARITIES } from '../core/rewards'
import { WORLD_IDS } from '../core/worlds'
import { number, t, worldName } from '../i18n'
import type { Save } from '../persistence/save'
import { downloadFile } from './download'
import { DISPLAY_FONT, TEXT_FONT } from './fonts'
import { WEB_URL } from './links'
import { isApp, shareInApp } from './native'

const RARITY_CSS = ['#cfd8e6', '#6fe08a', '#4fb0ff', '#c77dff', '#ffcf4a']

/** The numbers worth bragging about. */
export function brag(save: Save): {
  found: number
  total: number
  shiny: number
  distance: string
} {
  const finds = Object.values(save.collection)
  return {
    found: finds.length,
    total: ITEMS.length,
    shiny: finds.filter((find) => find.shiny > 0).length,
    distance: number(save.stats.bestDistance),
  }
}

function loadImage(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(undefined)
    image.src = src
  })
}

/** The picture's size, as link previews like it, and the least margin around its content. */
export const PICTURE = { width: 1200, height: 630, margin: 48 } as const

/**
 * The grid of treasures, a row per world and a column per rarity, at the right edge, and the
 * margin of the whole picture: the grid's distance to the top, the bottom and the right edge,
 * which the left column keeps to the left edge too.
 */
export function pictureGrid(rows: number, columns: number) {
  const { width, height } = PICTURE
  const gap = 8
  // As large as the height allows within the least margin, whole pixels.
  const cell = Math.floor((height - 2 * PICTURE.margin - (rows - 1) * gap) / rows)
  const gridWidth = columns * cell + (columns - 1) * gap
  const gridHeight = rows * cell + (rows - 1) * gap
  const margin = Math.floor((height - gridHeight) / 2)
  return { cell, gap, margin, left: width - margin - gridWidth, top: margin }
}

/** Sets the font, smaller if the text would be wider than `room`. */
function fitFont(
  g: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  room: number,
  family = TEXT_FONT,
): void {
  let px = size
  do {
    g.font = `${weight} ${px}px ${family}`
    px -= 1
  } while (px > 8 && g.measureText(text).width > room)
}

/**
 * A card picture of the collection, 1200 × 630 as link previews like them: the title, the
 * numbers and the address on the left, and on the right a grid of every world's five treasures,
 * found ones with their pictures, with the same margin to every edge.
 */
export async function collectionPicture(
  save: Save,
  thumbnail: (id: string, shiny: boolean) => string,
): Promise<Blob | undefined> {
  const { width, height } = PICTURE
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const g = canvas.getContext('2d')
  if (!g) return undefined
  // The game's fonts, which a canvas uses only once they have loaded.
  await document.fonts?.ready
  const background = g.createLinearGradient(0, 0, width, height)
  background.addColorStop(0, '#1b0f45')
  background.addColorStop(0.55, '#0c0726')
  background.addColorStop(1, '#2a0f3a')
  g.fillStyle = background
  g.fillRect(0, 0, width, height)
  // A few stars.
  for (let index = 0; index < 140; index++) {
    g.fillStyle = `rgba(255, 255, 255, ${0.2 + ((index * 37) % 10) / 20})`
    g.fillRect((index * 397) % width, (index * 211) % height, 2, 2)
  }

  // The grid's world names stand right before it; the left column keeps clear of the longest.
  const grid = pictureGrid(WORLD_IDS.length, RARITIES.length)
  const margin = grid.margin
  const labelRight = grid.left - 14
  g.font = `600 15px ${TEXT_FONT}`
  const labelWidth = Math.max(...WORLD_IDS.map((world) => g.measureText(worldName(world)).width))
  const room = labelRight - Math.min(labelWidth, 190) - 28 - margin

  const numbers = brag(save)
  g.textBaseline = 'alphabetic'
  const title = g.createLinearGradient(margin, 0, margin + room, 0)
  title.addColorStop(0, '#ffb8e6')
  title.addColorStop(0.5, '#c9a8ff')
  title.addColorStop(1, '#8ff4ff')
  g.fillStyle = title
  fitFont(g, 'WORMHOLE', 900, 60, room, DISPLAY_FONT)
  // The capitals' tops on the margin, measured in the font that is there.
  const ascent = g.measureText('WORMHOLE').actualBoundingBoxAscent
  g.fillText('WORMHOLE', margin, margin + ascent)
  g.fillText('SURFING', margin, margin + ascent * 2.6)
  const stat = (value: string, label: string, color: string, size: number, baseline: number) => {
    g.fillStyle = color
    fitFont(g, value, 800, size, room, DISPLAY_FONT)
    g.fillText(value, margin, baseline)
    g.fillStyle = '#b9b2dc'
    fitFont(g, label, 500, 26, room)
    g.fillText(label, margin, baseline + 34)
  }
  stat(`${numbers.found} / ${numbers.total}`, t('shareTreasures'), '#f4f1ff', 54, 262)
  stat(`✦ ${numbers.shiny}`, t('shareShiny'), '#ffd36b', 40, 370)
  stat(`${numbers.distance} ly`, t('shareFarthest'), '#8ff4ff', 40, 476)
  // The address's baseline on the bottom margin, as the title's capitals on the top one.
  const address = WEB_URL.replace('https://', '')
  g.fillStyle = '#b9b2dc'
  fitFont(g, address, 500, 20, room)
  g.fillText(address, margin, height - margin)

  for (const [row, world] of WORLD_IDS.entries()) {
    const y = grid.top + row * (grid.cell + grid.gap)
    g.fillStyle = '#b9b2dc'
    g.textAlign = 'right'
    g.textBaseline = 'middle'
    fitFont(g, worldName(world), 600, 15, 190)
    g.fillText(worldName(world), labelRight, y + grid.cell / 2)
    for (const [column, rarity] of RARITIES.entries()) {
      const item = ITEMS.find((entry) => entry.world === world && entry.rarity === rarity)
      if (!item) continue
      const x = grid.left + column * (grid.cell + grid.gap)
      const find = save.collection[item.id]
      g.fillStyle = find ? 'rgba(40, 26, 90, 0.9)' : 'rgba(30, 20, 60, 0.6)'
      g.strokeStyle = find ? (RARITY_CSS[column] ?? '#fff') : 'rgba(190, 170, 255, 0.25)'
      g.lineWidth = find ? 3 : 1.5
      g.beginPath()
      g.roundRect(x, y, grid.cell, grid.cell, 12)
      g.fill()
      g.stroke()
      if (find) {
        const image = await loadImage(thumbnail(item.id, find.shiny > 0))
        if (image) g.drawImage(image, x + 4, y + 4, grid.cell - 8, grid.cell - 8)
      } else {
        g.fillStyle = 'rgba(255, 255, 255, 0.25)'
        g.font = `700 26px ${TEXT_FONT}`
        g.textAlign = 'center'
        g.fillText('?', x + grid.cell / 2, y + grid.cell / 2 + 1)
      }
    }
  }
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/png'))
}

export type ShareResult = 'shared' | 'saved' | 'cancelled' | 'failed'

/**
 * Shares the collection: through the device's share sheet with the picture where it can, else
 * the text and link; where there is no share sheet, saves the picture and copies the text.
 */
export async function shareCollection(
  save: Save,
  thumbnail: (id: string, shiny: boolean) => string,
): Promise<ShareResult> {
  const numbers = brag(save)
  const text = t('shareText', numbers)
  const title = t('shareTitle')
  const blob = await collectionPicture(save, thumbnail)
  const name = 'wormhole-surfing-collection.png'
  // Android's WebView has no share sheet of its own: the app hands the picture to Android's.
  if (isApp()) {
    try {
      if (!blob) return 'failed'
      await shareInApp(name, blob, title, `${text} ${WEB_URL}`)
      return 'shared'
    } catch {
      return 'failed'
    }
  }
  const file = blob ? new File([blob], name, { type: 'image/png' }) : undefined
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text: `${text} ${WEB_URL}` })
      return 'shared'
    }
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text, url: WEB_URL })
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
  }
  try {
    if (blob) downloadFile(name, blob)
    await navigator.clipboard?.writeText(`${text} ${WEB_URL}`)
    return 'saved'
  } catch {
    return 'failed'
  }
}
