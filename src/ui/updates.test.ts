import { afterEach, describe, expect, it, vi } from 'vitest'
import { pendingUpdate, registerServiceWorker } from './updates'

class FakeWorker extends EventTarget {
  state = 'installing'
  readonly postMessage = vi.fn()
}

class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null = null
  installing: FakeWorker | null = null
  readonly update = vi.fn(async () => {})

  /** A new version arrives and installs, as browsers report it. */
  arrive(worker = new FakeWorker()): FakeWorker {
    this.installing = worker
    this.dispatchEvent(new Event('updatefound'))
    this.installing = null
    this.waiting = worker
    worker.state = 'installed'
    worker.dispatchEvent(new Event('statechange'))
    return worker
  }
}

/** A browser's service workers, with a page that an older worker serves or none. */
function browser(served: boolean) {
  const registration = new FakeRegistration()
  const container = Object.assign(new EventTarget(), {
    controller: served ? {} : null,
    register: vi.fn(async () => registration),
  })
  const reload = vi.fn()
  const start = () => registerServiceWorker(container as unknown as ServiceWorkerContainer, reload)
  return { registration, container, reload, start }
}

afterEach(() => {
  pendingUpdate.value = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('registerServiceWorker', () => {
  it('does nothing in browsers without service workers', async () => {
    await registerServiceWorker(undefined)
    expect(pendingUpdate.value).toBeUndefined()
  })

  it('registers the worker, and lets the first version take over by itself', async () => {
    const { registration, container, start } = browser(false)
    await start()
    expect(container.register).toHaveBeenCalledWith('./sw.js')
    registration.arrive()
    expect(pendingUpdate.value).toBeUndefined()
  })

  it('offers a new version, and reloads once it has taken over', async () => {
    const { registration, container, reload, start } = browser(true)
    await start()
    const worker = registration.arrive()
    pendingUpdate.value?.()
    expect(worker.postMessage).toHaveBeenCalledWith('skipWaiting')
    expect(reload).not.toHaveBeenCalled()
    container.dispatchEvent(new Event('controllerchange'))
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('offers a version that was already waiting when the page loaded', async () => {
    const { registration, start } = browser(true)
    const worker = new FakeWorker()
    registration.waiting = worker
    await start()
    pendingUpdate.value?.()
    expect(worker.postMessage).toHaveBeenCalledWith('skipWaiting')
  })

  it('carries on without offline play when the worker cannot register', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container, start } = browser(false)
    container.register.mockRejectedValueOnce(new Error('blocked'))
    await start()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('looks for a new version every hour, even when that fails', async () => {
    vi.useFakeTimers()
    const { registration, start } = browser(true)
    await start()
    registration.update.mockRejectedValueOnce(new Error('offline'))
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledTimes(2)
  })
})
