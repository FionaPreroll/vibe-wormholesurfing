import { ITEMS, RARITIES } from '../core/rewards'
import { WORLD_IDS } from '../core/worlds'
import { number, t, worldName } from '../i18n'
import type { Save } from '../persistence/save'
import { downloadFile } from './download'
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

/**
 * A card picture of the collection, 1200 × 630 as link previews like them: the title, the
 * numbers, and a grid of every world's five treasures, found ones with their pictures.
 */
export async function collectionPicture(
  save: Save,
  thumbnail: (id: string, shiny: boolean) => string,
): Promise<Blob | undefined> {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const g = canvas.getContext('2d')
  if (!g) return undefined
  const background = g.createLinearGradient(0, 0, 1200, 630)
  background.addColorStop(0, '#1b0f45')
  background.addColorStop(0.55, '#0c0726')
  background.addColorStop(1, '#2a0f3a')
  g.fillStyle = background
  g.fillRect(0, 0, 1200, 630)
  // A few stars.
  for (let index = 0; index < 140; index++) {
    g.fillStyle = `rgba(255, 255, 255, ${0.2 + ((index * 37) % 10) / 20})`
    g.fillRect((index * 397) % 1200, (index * 211) % 630, 2, 2)
  }
  const numbers = brag(save)
  const title = g.createLinearGradient(60, 0, 560, 0)
  title.addColorStop(0, '#ffb8e6')
  title.addColorStop(0.5, '#c9a8ff')
  title.addColorStop(1, '#8ff4ff')
  g.fillStyle = title
  g.font = '900 64px system-ui, sans-serif'
  g.fillText('WORMHOLE', 60, 130)
  g.fillText('SURFING', 60, 200)
  g.fillStyle = '#f4f1ff'
  g.font = '800 54px system-ui, sans-serif'
  g.fillText(`${numbers.found} / ${numbers.total}`, 60, 300)
  g.font = '600 26px system-ui, sans-serif'
  g.fillStyle = '#b9b2dc'
  g.fillText(t('shareTreasures'), 60, 336)
  g.fillStyle = '#ffd36b'
  g.font = '800 40px system-ui, sans-serif'
  g.fillText(`✦ ${numbers.shiny}`, 60, 410)
  g.fillStyle = '#b9b2dc'
  g.font = '600 26px system-ui, sans-serif'
  g.fillText(t('shareShiny'), 60, 444)
  g.fillStyle = '#8ff4ff'
  g.font = '800 40px system-ui, sans-serif'
  g.fillText(`${numbers.distance} ly`, 60, 518)
  g.fillStyle = '#b9b2dc'
  g.font = '600 26px system-ui, sans-serif'
  g.fillText(t('shareFarthest'), 60, 552)
  g.font = '600 20px system-ui, sans-serif'
  g.fillText(WEB_URL.replace('https://', ''), 60, 600)

  // The grid: a row per world, a column per rarity.
  const left = 600
  const top = 40
  const cell = 66
  const gap = 8
  g.font = '700 15px system-ui, sans-serif'
  for (const [row, world] of WORLD_IDS.entries()) {
    const y = top + row * (cell + gap)
    g.fillStyle = '#b9b2dc'
    g.textAlign = 'right'
    g.fillText(worldName(world), left - 12, y + cell / 2 + 5)
    g.textAlign = 'left'
    for (const [column, rarity] of RARITIES.entries()) {
      const item = ITEMS.find((entry) => entry.world === world && entry.rarity === rarity)
      if (!item) continue
      const x = left + column * (cell + gap)
      const find = save.collection[item.id]
      g.fillStyle = find ? 'rgba(40, 26, 90, 0.9)' : 'rgba(30, 20, 60, 0.6)'
      g.strokeStyle = find ? (RARITY_CSS[column] ?? '#fff') : 'rgba(190, 170, 255, 0.25)'
      g.lineWidth = find ? 3 : 1.5
      g.beginPath()
      g.roundRect(x, y, cell, cell, 12)
      g.fill()
      g.stroke()
      if (find) {
        const image = await loadImage(thumbnail(item.id, find.shiny > 0))
        if (image) g.drawImage(image, x + 4, y + 4, cell - 8, cell - 8)
      } else {
        g.fillStyle = 'rgba(255, 255, 255, 0.25)'
        g.font = '800 28px system-ui, sans-serif'
        g.textAlign = 'center'
        g.fillText('?', x + cell / 2, y + cell / 2 + 10)
        g.textAlign = 'left'
        g.font = '700 15px system-ui, sans-serif'
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
