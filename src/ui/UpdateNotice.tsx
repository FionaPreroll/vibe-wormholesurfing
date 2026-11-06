import { useState } from 'preact/hooks'
import { t } from '../i18n'
import { pendingUpdate } from './updates'

/** Tells the player that a new version is ready, and reloads into it when they choose. */
export function UpdateNotice() {
  const [later, setLater] = useState(false)
  const apply = pendingUpdate.value
  if (apply === undefined || later) return null
  return (
    <p class="notice update" role="status">
      <span>{t('updateReady')}</span>
      <button type="button" onClick={apply}>
        {t('updateReload')}
      </button>
      <button type="button" onClick={() => setLater(true)}>
        {t('updateLater')}
      </button>
    </p>
  )
}
