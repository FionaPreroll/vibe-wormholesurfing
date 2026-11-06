import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { t } from '../i18n'
import { isApp } from './native'

const fullScreen = signal(false)
/** The browser said no, as Safari does to a controller's button: only a click or a key will do. */
const refused = signal(false)

/** The Android app fills the screen by itself (MainActivity.java); browsers do on request. */
function canGoFullScreen(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true && !isApp()
}

/** Fills the screen and, where the browser allows, holds it in landscape. */
export async function enterFullScreen(): Promise<void> {
  if (!canGoFullScreen() || document.fullscreenElement) return
  refused.value = false
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape') => Promise<void>
    }
    await orientation.lock?.('landscape').catch(() => {})
  } catch (error) {
    refused.value = true
    console.warn('Full screen is not possible', error)
  }
}

/**
 * In every browser: the browser's bars take room from the game, and a player on the couch with a
 * controller has no other way to hide them. Chrome and Firefox take a controller's button as the
 * player's own action, as they do a click; where a browser does not, a note says what will.
 */
export function FullScreenButton() {
  useEffect(() => {
    const update = () => {
      fullScreen.value = document.fullscreenElement !== null
    }
    update()
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  if (!canGoFullScreen()) return null
  const on = fullScreen.value
  return (
    <>
      <button
        type="button"
        class="ghost small"
        aria-pressed={on}
        onClick={() => (on ? void document.exitFullscreen() : void enterFullScreen())}
      >
        {t(on ? 'leaveFullScreen' : 'fullScreen')}
      </button>
      {refused.value && !on && (
        <span class="note" role="status">
          {t('fullScreenRefused')}
        </span>
      )}
    </>
  )
}
