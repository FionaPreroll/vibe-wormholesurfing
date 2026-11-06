import { createStore, get, set } from 'idb-keyval'

/** Where saves go: IndexedDB in the browser, a map in tests. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

/** A store that lives in memory only, for tests and for browsers that block IndexedDB. */
export function memoryStore(entries: Record<string, unknown> = {}): KeyValueStore {
  const values = new Map(Object.entries(entries))
  return {
    get: async (key) => structuredClone(values.get(key)),
    set: async (key, value) => {
      values.set(key, structuredClone(value))
    },
  }
}

/** The browser's IndexedDB, through idb-keyval, in a database of the game's own. */
export function browserStore(): KeyValueStore {
  const store = createStore('vibe-wormholesurfing', 'saves')
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
  }
}
