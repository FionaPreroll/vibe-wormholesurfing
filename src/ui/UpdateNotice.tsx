import { useState } from 'preact/hooks'
import { t } from '../i18n'
import { desktopUpdate, downloadDesktopUpdate } from './desktopUpdates'
import { pendingUpdate } from './updates'

/** Tells the player that a new version is ready, and reloads into it when they choose. */
export function UpdateNotice() {
  const [later, setLater] = useState(false)
  const apply = pendingUpdate.value
  if (apply === undefined || later) return null
  return (
    <p class="notice update" role="status">
      <span>{t('webUpdateReady')}</span>
      <button type="button" onClick={apply}>
        {t('updateReload')}
      </button>
      <button type="button" onClick={() => setLater(true)}>
        {t('updateLater')}
      </button>
    </p>
  )
}

/**
 * In the desktop app: a newer build is out. Download opens it in the browser, and the notice then
 * says how it installs; Later puts it off until the next start.
 */
export function DesktopUpdateNotice() {
  const [started, setStarted] = useState(false)
  const build = desktopUpdate.value
  if (started) {
    return (
      <p class="notice update" role="status">
        <span>{t('desktopUpdateStarted')}</span>
        <button type="button" onClick={() => setStarted(false)}>
          {t('close')}
        </button>
      </p>
    )
  }
  if (build === undefined) return null
  return (
    <p class="notice update" role="status">
      <span>{t('updateReady', { build })}</span>
      <button
        type="button"
        onClick={() => {
          downloadDesktopUpdate()
          setStarted(true)
        }}
      >
        {t('updateDownload')}
      </button>
      <button
        type="button"
        onClick={() => {
          desktopUpdate.value = undefined
        }}
      >
        {t('updateLater')}
      </button>
    </p>
  )
}
