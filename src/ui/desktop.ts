/** What the desktop app's preload (desktop/preload.cts) hands the page. */
export interface DesktopApp {
  /** Node's name for the system: 'win32', 'darwin' or 'linux'. */
  readonly platform: string
}

/** The desktop app, when the page runs in it; in a browser and the Android app, nothing. */
export function desktopApp(): DesktopApp | undefined {
  return (globalThis as { wormholeDesktop?: DesktopApp }).wormholeDesktop
}

/** True inside the desktop app for Windows, macOS and Linux. */
export function isDesktop(): boolean {
  return desktopApp() !== undefined
}
