import { isLocale, LOCALES, type Locale, locale, setLocale, t } from '../i18n'

/** Each language is named in itself, so players recognise their own. */
const NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch' }

export function LanguageSwitch() {
  return (
    <label class="language">
      <span>{t('language')}</span>
      <select
        value={locale.value}
        onChange={(event) => {
          const { value } = event.currentTarget
          if (isLocale(value)) setLocale(value)
        }}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  )
}
