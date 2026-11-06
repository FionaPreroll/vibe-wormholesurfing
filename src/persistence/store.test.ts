import { describe, expect, it, vi } from 'vitest'
import { browserStore, memoryStore } from './store'

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => 'store'),
  get: vi.fn(async (key: string, store: unknown) => `${String(store)}:${key}`),
  set: vi.fn(async () => undefined),
}))

describe('memoryStore', () => {
  it('keeps copies, so later changes to a value do not leak in', async () => {
    const store = memoryStore({ a: 1 })
    const value = { list: [1] }
    await store.set('b', value)
    value.list.push(2)
    expect(await store.get('b')).toEqual({ list: [1] })
    expect(await store.get('a')).toBe(1)
  })
})

describe('browserStore', () => {
  it('reads and writes through idb-keyval in a database of its own', async () => {
    const idb = await import('idb-keyval')
    const store = browserStore()
    expect(idb.createStore).toHaveBeenCalledWith('vibe-wormholesurfing', 'saves')
    expect(await store.get('save')).toBe('store:save')
    await store.set('save', 1)
    expect(idb.set).toHaveBeenCalledWith('save', 1, 'store')
  })
})
