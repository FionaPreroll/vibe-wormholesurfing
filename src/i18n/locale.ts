export const LOCALES = ['en', 'de'] as const
export type Locale = (typeof LOCALES)[number]

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** First supported language in the browser's preference list; English when none matches. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const code = language.toLowerCase().split('-')[0]
    if (isLocale(code)) return code
  }
  return 'en'
}
