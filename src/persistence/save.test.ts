import { describe, expect, it } from 'vitest'
import { itemById } from '../core/rewards'
import { DEFAULT_SETTINGS } from '../game/settings'
import { exportSave, freshSave, importSave, migrate, SaveBook } from './save'
import { memoryStore } from './store'

const pearl = itemById('tidePearl')
if (!pearl) throw new Error('missing item')

describe('migrate', () => {
  it('keeps a valid save', () => {
    const save = freshSave()
    expect(migrate(save)).toEqual(save)
  })

  it('starts afresh from rubbish, keeping settings that still read', () => {
    expect(migrate(42)).toEqual(freshSave())
    const kept = migrate({ settings: { ...DEFAULT_SETTINGS, music: 0.1 }, collection: 'broken' })
    expect(kept.settings.music).toBe(0.1)
    expect(kept.collection).toEqual({})
  })

  it('fixes single broken settings with their defaults', () => {
    const save = { ...freshSave(), settings: { ...DEFAULT_SETTINGS, quality: 'insane', sound: 7 } }
    const read = migrate(save)
    expect(read.settings.quality).toBe(DEFAULT_SETTINGS.quality)
    expect(read.settings.sound).toBe(DEFAULT_SETTINGS.sound)
  })
})

describe('SaveBook', () => {
  it('collects treasures and counts them, shiny ones apart', async () => {
    const store = memoryStore()
    const book = await SaveBook.open(store)
    expect(await book.addFind({ item: pearl, shiny: false }, 1)).toEqual({ fresh: true, count: 1 })
    expect(await book.addFind({ item: pearl, shiny: true }, 2)).toEqual({ fresh: false, count: 2 })
    expect(book.current.collection.tidePearl).toEqual({ count: 2, shiny: 1, first: 1 })
    expect(book.found.has('tidePearl')).toBe(true)
    const again = await SaveBook.open(store)
    expect(again.current.collection.tidePearl?.count).toBe(2)
  })

  it('keeps records of rides', async () => {
    const book = await SaveBook.open(memoryStore())
    await book.recordRide(1200, 2, 'lagoon')
    await book.recordRide(800, 4, 'lagoon')
    const stats = book.current.stats
    expect(stats.rides).toBe(2)
    expect(stats.bestDistance).toBe(1200)
    expect(stats.totalDistance).toBe(2000)
    expect(stats.worlds.lagoon).toBe(2)
    expect(stats.tiers).toEqual([0, 1, 0, 1])
  })

  it('forgets progress on reset but keeps settings', async () => {
    const book = await SaveBook.open(memoryStore())
    await book.setSettings({ ...DEFAULT_SETTINGS, music: 0.2 })
    await book.addFind({ item: pearl, shiny: false })
    await book.markSeen('rideHint')
    await book.reset()
    expect(book.current.collection).toEqual({})
    expect(book.current.seen.rideHint).toBe(false)
    expect(book.current.settings.music).toBe(0.2)
  })
})

describe('exportSave and importSave', () => {
  it('carry a save through a file unchanged', async () => {
    const book = await SaveBook.open(memoryStore())
    await book.addFind({ item: pearl, shiny: true }, 5)
    await book.recordRide(900, 3, 'lagoon')
    const file = exportSave(book.current, new Date('2026-11-06T12:00:00Z'))
    expect(JSON.parse(file)).toMatchObject({
      format: 'vibe-wormholesurfing-save',
      exportedAt: '2026-11-06T12:00:00.000Z',
    })
    expect(importSave(file)).toEqual(book.current)
  })

  it('refuses files that are not saves', () => {
    expect(importSave('not json')).toBeUndefined()
    expect(
      importSave(JSON.stringify({ format: 'vibe-laser-profile', save: freshSave() })),
    ).toBeUndefined()
    expect(
      importSave(JSON.stringify({ format: 'vibe-wormholesurfing-save', save: { version: 99 } })),
    ).toBeUndefined()
  })

  it('replaces the save in the book', async () => {
    const book = await SaveBook.open(memoryStore())
    const other = { ...freshSave(), collection: { tidePearl: { count: 3, shiny: 0, first: 1 } } }
    await book.replace(other)
    expect(book.current.collection.tidePearl?.count).toBe(3)
  })
})
