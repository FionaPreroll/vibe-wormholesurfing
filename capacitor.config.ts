import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Android app: the web build (`dist`) packed into a native app, which shows it in Android's
 * WebView. See "The Android app" in the README.
 */
const config: CapacitorConfig = {
  appId: 'io.github.fionapreroll.wormholesurfing',
  appName: 'Wormhole Surfing',
  webDir: 'dist',
  android: {
    // The page draws its own dark background: no white flash while the WebView starts.
    backgroundColor: '#0a0618',
  },
  plugins: {
    // The only releases the app's updates read and download from (@fionapreroll/app-updates).
    AppUpdater: { releases: 'https://github.com/FionaPreroll/vibe-wormholesurfing/releases/' },
  },
}

export default config
