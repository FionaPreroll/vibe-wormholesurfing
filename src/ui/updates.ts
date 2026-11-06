import { signal } from '@preact/signals'

/** The worker that tools/serviceWorker.ts writes next to index.html. */
const WORKER = './sw.js'
const HOUR = 60 * 60 * 1000

/**
 * A new version of the game that is installed and waits to take over: calling it lets the new
 * version in and reloads the page.
 */
export const pendingUpdate = signal<(() => void) | undefined>(undefined)

/**
 * Registers the service worker that keeps the game for offline play. A new version waits until
 * the player chooses to reload, so it never swaps the game out under a level in progress. While
 * the page stays open, it looks for one every hour.
 */
export async function registerServiceWorker(
  container: ServiceWorkerContainer | undefined = navigator.serviceWorker,
  reload: () => void = () => location.reload(),
): Promise<void> {
  if (container === undefined) return
  let registration: ServiceWorkerRegistration
  try {
    registration = await container.register(WORKER)
  } catch (error) {
    console.warn('The game cannot be kept for offline play', error)
    return
  }
  // A worker that waits while another one serves the page is a new version. The very first one
  // takes over by itself.
  const offer = () => {
    const waiting = registration.waiting
    if (waiting === null || container.controller === null) return
    pendingUpdate.value = () => {
      container.addEventListener('controllerchange', () => reload(), { once: true })
      waiting.postMessage('skipWaiting')
    }
  }
  offer()
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed') offer()
    })
  })
  setInterval(() => {
    registration.update().catch(() => {
      // Offline or unreachable: the next look will do.
    })
  }, HOUR)
}
