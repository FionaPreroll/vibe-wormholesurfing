import { signal } from '@preact/signals'
import { isApp } from './native'

/** The browser's offer to install the game, kept until the player asks for it. */
interface InstallPrompt extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const installPrompt = signal<InstallPrompt | undefined>(undefined)

/** Whether the game runs as an installed app, or wrapped in a native shell, not in a browser tab. */
export function runsAsApp(): boolean {
  if (typeof window === 'undefined') return false
  if (isApp()) return true
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return (
    standalone ||
    (typeof matchMedia === 'function' &&
      matchMedia(
        '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)',
      ).matches)
  )
}

/** Keeps the browser's install offer for the about page's button. */
export function watchInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt.value = event as InstallPrompt
  })
  window.addEventListener('appinstalled', () => {
    installPrompt.value = undefined
  })
}

/** Asks the browser to install the game; true when the player agreed. */
export async function install(): Promise<boolean> {
  const prompt = installPrompt.value
  if (!prompt) return false
  await prompt.prompt()
  const choice = await prompt.userChoice
  installPrompt.value = undefined
  return choice.outcome === 'accepted'
}
