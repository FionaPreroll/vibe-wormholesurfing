import { effect } from '@preact/signals'
import { render } from 'preact'
import { version } from '../package.json'
import { captureErrors, debugLog } from './game/debugLog'
import { locale } from './i18n'
import { App } from './ui/App'
import { registerServiceWorker } from './ui/updates'
import './ui/styles.css'

captureErrors()
debugLog.setEnvironment({
  version,
  userAgent: navigator.userAgent,
  languages: [...navigator.languages],
  screen: `${screen.width}×${screen.height}`,
  devicePixelRatio: window.devicePixelRatio,
  cores: navigator.hardwareConcurrency,
  memoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  touch: navigator.maxTouchPoints,
  installed: matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches,
})
debugLog.log('info', `Wormhole Surfing ${version} started`)

effect(() => {
  document.documentElement.lang = locale.value
})

const root = document.getElementById('app')
if (!root) throw new Error('index.html has no #app element')
render(<App />, root)

// Only web builds have a service worker; the dev server, and the app wrapped for Android with
// Capacitor, serve their files as they are.
const native = 'Capacitor' in window
if (import.meta.env.PROD && !native) {
  window.addEventListener('load', () => void registerServiceWorker())
}
