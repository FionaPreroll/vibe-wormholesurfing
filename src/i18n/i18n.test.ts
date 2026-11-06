import { describe, expect, it } from 'vitest'
import { ITEMS, RARITIES } from '../core/rewards'
import { WORLD_IDS } from '../core/worlds'
import { format } from './format'
import { detectLocale, isLocale } from './locale'
import { de, en, type MessageKey } from './messages'

describe('detectLocale', () => {
  it('picks the first supported language the browser prefers', () => {
    expect(detectLocale(['de-DE', 'en-US'])).toBe('de')
    expect(detectLocale(['fr-FR', 'de-AT', 'en'])).toBe('de')
    expect(detectLocale(['en-GB', 'de'])).toBe('en')
  })

  it('falls back to English', () => {
    expect(detectLocale(['fr-FR', 'it'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('isLocale', () => {
  it('accepts only supported language codes', () => {
    expect(isLocale('de')).toBe(true)
    expect(isLocale('DE')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })
})

describe('format', () => {
  it('fills placeholders and keeps unknown ones', () => {
    expect(format('{found} of {total}', { found: 3, total: 40 })).toBe('3 of 40')
    expect(format('{missing} stays', {})).toBe('{missing} stays')
  })
})

describe('message catalogs', () => {
  const placeholders = (text: string) =>
    [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

  it.each(Object.keys(en) as MessageKey[])('%s has the same placeholders in German', (key) => {
    expect(placeholders(de[key])).toEqual(placeholders(en[key]))
  })

  it('names every treasure, world and rarity', () => {
    for (const item of ITEMS) {
      expect(Object.hasOwn(en, `item_${item.id}`)).toBe(true)
      expect(Object.hasOwn(en, `desc_${item.id}`)).toBe(true)
    }
    for (const world of WORLD_IDS) expect(Object.hasOwn(en, `world_${world}`)).toBe(true)
    for (const rarity of RARITIES) expect(Object.hasOwn(en, `rarity_${rarity}`)).toBe(true)
  })
})
