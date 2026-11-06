import { z } from 'zod'
import type { HoleTier } from '../core/holes'
import type { Reward } from '../core/rewards'
import type { WorldId } from '../core/worlds'
import { DEFAULT_SETTINGS, QUALITIES, type Settings } from '../game/settings'
import { SaveQueue } from './queue'
import type { KeyValueStore } from './store'

const KEY = 'save'
export const SAVE_VERSION = 1

const settingsSchema = z.object({
  sound: z.number().min(0).max(1).catch(DEFAULT_SETTINGS.sound),
  music: z.number().min(0).max(1).catch(DEFAULT_SETTINGS.music),
  quality: z.enum(QUALITIES).catch(DEFAULT_SETTINGS.quality),
  gyro: z.boolean().catch(DEFAULT_SETTINGS.gyro),
  gyroRange: z.number().min(8).max(45).catch(DEFAULT_SETTINGS.gyroRange),
  invertY: z.boolean().catch(DEFAULT_SETTINGS.invertY),
  mouseSteer: z.boolean().catch(DEFAULT_SETTINGS.mouseSteer),
  lookSpeed: z.number().min(0.3).max(2.5).catch(DEFAULT_SETTINGS.lookSpeed),
  reducedMotion: z.boolean().catch(DEFAULT_SETTINGS.reducedMotion),
  vibration: z.boolean().catch(DEFAULT_SETTINGS.vibration),
  showFps: z.boolean().catch(DEFAULT_SETTINGS.showFps),
})

const findSchema = z.object({
  count: z.number().int().min(0),
  shiny: z.number().int().min(0),
  /** When it was first found, in ms since 1970. */
  first: z.number(),
})

const statsSchema = z.object({
  rides: z.number().int().min(0),
  bestDistance: z.number().min(0),
  totalDistance: z.number().min(0),
  /** Visits per world. */
  worlds: z.record(z.string(), z.number().int().min(0)),
  /** Holes entered per tier, 1 to 4. */
  tiers: z.tuple([z.number(), z.number(), z.number(), z.number()]),
})

const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  settings: settingsSchema,
  collection: z.record(z.string(), findSchema),
  stats: statsSchema,
  /** Hints already shown once. */
  seen: z.object({ rideHint: z.boolean(), worldHint: z.boolean() }),
})

export type Save = z.infer<typeof saveSchema>
export type Find = z.infer<typeof findSchema>

export function freshSave(): Save {
  return {
    version: SAVE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    collection: {},
    stats: { rides: 0, bestDistance: 0, totalDistance: 0, worlds: {}, tiers: [0, 0, 0, 0] },
    seen: { rideHint: false, worldHint: false },
  }
}

/**
 * Reads a stored save of any version. Later formats will convert older saves here; a record that
 * cannot be read starts afresh, keeping whatever settings survive.
 */
export function migrate(stored: unknown): Save {
  const parsed = saveSchema.safeParse(stored)
  if (parsed.success) return parsed.data
  const fresh = freshSave()
  if (stored && typeof stored === 'object' && 'settings' in stored) {
    const settings = settingsSchema.safeParse((stored as { settings: unknown }).settings)
    if (settings.success) return { ...fresh, settings: settings.data }
  }
  return fresh
}

/** The player's save: settings, the collection, records and hints seen, in one stored record. */
export class SaveBook {
  #save: Save
  readonly #queue = new SaveQueue()

  private constructor(
    readonly store: KeyValueStore,
    save: Save,
  ) {
    this.#save = save
  }

  static async open(store: KeyValueStore): Promise<SaveBook> {
    return new SaveBook(store, migrate(await store.get(KEY)))
  }

  get current(): Save {
    return this.#save
  }

  get found(): ReadonlySet<string> {
    return new Set(Object.keys(this.#save.collection))
  }

  /** Changes the save and stores it, after any saves before. */
  update(change: (save: Save) => Save): Promise<void> {
    this.#save = change(this.#save)
    const snapshot = this.#save
    return this.#queue.run(() => this.store.set(KEY, snapshot))
  }

  setSettings(settings: Settings): Promise<void> {
    return this.update((save) => ({ ...save, settings }))
  }

  /** Counts a ride that ended in a hole. */
  recordRide(distance: number, tier: HoleTier, world: WorldId): Promise<void> {
    return this.update((save) => {
      const tiers = [...save.stats.tiers] as Save['stats']['tiers']
      tiers[tier - 1] = (tiers[tier - 1] ?? 0) + 1
      return {
        ...save,
        stats: {
          rides: save.stats.rides + 1,
          bestDistance: Math.max(save.stats.bestDistance, distance),
          totalDistance: save.stats.totalDistance + distance,
          worlds: { ...save.stats.worlds, [world]: (save.stats.worlds[world] ?? 0) + 1 },
          tiers,
        },
      }
    })
  }

  /** Adds a treasure to the collection and tells how often it has been found now. */
  async addFind(reward: Reward, now = Date.now()): Promise<{ fresh: boolean; count: number }> {
    const before = this.#save.collection[reward.item.id]
    const find: Find = {
      count: (before?.count ?? 0) + 1,
      shiny: (before?.shiny ?? 0) + (reward.shiny ? 1 : 0),
      first: before?.first ?? now,
    }
    await this.update((save) => ({
      ...save,
      collection: { ...save.collection, [reward.item.id]: find },
    }))
    return { fresh: before === undefined, count: find.count }
  }

  markSeen(hint: keyof Save['seen']): Promise<void> {
    return this.update((save) => ({ ...save, seen: { ...save.seen, [hint]: true } }))
  }

  /** Forgets every treasure and record, keeping the settings. */
  reset(): Promise<void> {
    return this.update((save) => ({ ...freshSave(), settings: save.settings }))
  }

  saved(): Promise<void> {
    return this.#queue.saved()
  }
}
