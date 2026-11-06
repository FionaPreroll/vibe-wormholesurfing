import { signal } from '@preact/signals'
import type { Rarity } from '../core/rewards'
import type { WorldId } from '../core/worlds'
import { format } from './format'
import { detectLocale, isLocale, type Locale } from './locale'
import { de, en, type MessageKey } from './messages'

export { isLocale, LOCALES, type Locale } from './locale'
export type { MessageKey } from './messages'

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, de }

// The language is a choice of the browser, not of the save, and stays in localStorage.
const STORAGE_KEY = 'vibe-wormholesurfing.locale'

function storedLocale(): Locale | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isLocale(value) ? value : undefined
  } catch {
    return undefined
  }
}

/** The interface language. Components that call t() re-render when it changes. */
export const locale = signal<Locale>(
  storedLocale() ?? detectLocale(typeof navigator === 'undefined' ? [] : navigator.languages),
)

export function setLocale(next: Locale): void {
  locale.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage can be blocked, for example in private windows; the choice then lasts for this visit.
  }
}

/** Text in the current language, with {placeholders} filled from params. */
export function t(key: MessageKey, params?: Readonly<Record<string, string | number>>): string {
  return format(catalogs[locale.value][key], params)
}

/** A whole number with the language's grouping, as 12,345 or 12.345. */
export function number(value: number): string {
  return new Intl.NumberFormat(locale.value === 'de' ? 'de-DE' : 'en-US').format(Math.round(value))
}

export function itemName(id: string): string {
  const key = `item_${id}`
  return key in en ? t(key as MessageKey) : id
}

export function worldName(world: WorldId): string {
  return t(`world_${world}`)
}

export function rarityName(rarity: Rarity): string {
  return t(`rarity_${rarity}`)
}
