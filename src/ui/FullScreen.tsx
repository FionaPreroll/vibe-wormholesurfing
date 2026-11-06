import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { t } from '../i18n'
import { touchScreen } from './pointer'

const fullScreen = signal(false)

function canGoFullScreen(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true
}

/** Fills the screen and, where the browser allows, holds it in landscape. */
export async function enterFullScreen(): Promise<void> {
  if (!canGoFullScreen() || document.fullscreenElement) return
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape') => Promise<void>
    }
    await orientation.lock?.('landscape').catch(() => {})
  } catch (error) {
    console.warn('Full screen is not possible', error)
  }
}

/** On touch screens: the browser's bars take a lot of room from the game. */
export function FullScreenButton() {
  useEffect(() => {
    const update = () => {
      fullScreen.value = document.fullscreenElement !== null
    }
    update()
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  if (!touchScreen.value || !canGoFullScreen()) return null
  const on = fullScreen.value
  return (
    <button
      type="button"
      class="ghost"
      aria-pressed={on}
      onClick={() => (on ? void document.exitFullscreen() : void enterFullScreen())}
    >
      {t(on ? 'leaveFullScreen' : 'fullScreen')}
    </button>
  )
}
