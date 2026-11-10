import { browserSystem, desktopApp } from './desktop'
import { runsAsApp } from './install'
import { isApp } from './native'

/**
 * How the game can be left from its own menu: the desktop app quits, and the web app installed on
 * a computer closes its window. A browser tab belongs to the browser, and on phones and tablets,
 * the Android app among them, apps are left with the system's own buttons, so there is none there.
 * Browsers let a page close its window only while it is the one page the window has shown, as the
 * installed app's window is from its start: otherwise the button would do nothing.
 */
export function quitMethod(): 'desktop' | 'window' | undefined {
  if (desktopApp()) return 'desktop'
  if (!isApp() && runsAsApp() && browserSystem() !== undefined && history.length <= 1) {
    return 'window'
  }
  return undefined
}

/** Leaves the game: quits the desktop app, or closes the installed web app's window. */
export function quitGame(): void {
  const desktop = desktopApp()
  if (desktop) desktop.quit()
  // The window the browser opened for the installed app, with nothing to go back to, closes when
  // its page asks.
  else window.close()
}
