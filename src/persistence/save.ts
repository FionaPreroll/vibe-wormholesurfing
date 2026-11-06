import { z } from 'zod'
import type { HoleTier } from '../core/holes'
import type { Reward } from '../core/rewards'
import type { WorldId } from '../core/worlds'
import { DEFAULT_SETTINGS, QUALITIES, type Settings } from '../game/settings'
import { ACTIONS, type Action, KEY_SLOTS, PAD_SLOTS } from '../input/bindings'
import { DEAD_ZONE_SHAPES } from '../input/stick'
import { SaveQueue } from './queue'
import type { KeyValueStore } from './store'

const KEY = 'save'
export const SAVE_VERSION = 1

const stickSchema = (fallback: Settings['sticks']['move']) =>
  z
    .object({
      deadZone: z.number().min(0).max(0.5).catch(fallback.deadZone),
      shape: z.enum(DEAD_ZONE_SHAPES).catch(fallback.shape),
      sensitivity: z.number().min(0.25).max(3).catch(fallback.sensitivity),
    })
    .catch(fallback)

const sticksSchema = z
  .object({
    move: stickSchema(DEFAULT_SETTINGS.sticks.move),
    look: stickSchema(DEFAULT_SETTINGS.sticks.look),
    swap: z.boolean().catch(DEFAULT_SETTINGS.sticks.swap),
  })
  .catch(DEFAULT_SETTINGS.sticks)

/** One table of bindings, each action falling back to its defaults on its own. */
function tableSchema<T extends string | number>(
  entry: z.ZodType<T>,
  slots: number,
  fallback: Readonly<Record<Action, readonly T[]>>,
): z.ZodType<Readonly<Record<Action, readonly T[]>>> {
  const shape = Object.fromEntries(
    ACTIONS.map((action) => [action, z.array(entry).max(slots).readonly().catch(fallback[action])]),
  )
  return z.object(shape).catch(fallback) as unknown as z.ZodType<
    Readonly<Record<Action, readonly T[]>>
  >
}

const bindingsSchema = z
  .object({
    keys: tableSchema(z.string().min(1).max(40), KEY_SLOTS, DEFAULT_SETTINGS.bindings.keys),
    pad: tableSchema(z.number().int().min(0).max(31), PAD_SLOTS, DEFAULT_SETTINGS.bindings.pad),
  })
  .catch(DEFAULT_SETTINGS.bindings)

const settingsSchema = z.object({
  sound: z.number().min(0).max(1).catch(DEFAULT_SETTINGS.sound),
  music: z.number().min(0).max(1).catch(DEFAULT_SETTINGS.music),
  quality: z.enum(QUALITIES).catch(DEFAULT_SETTINGS.quality),
  gyro: z.boolean().catch(DEFAULT_SETTINGS.gyro),
  gyroRange: z.number().min(8).max(45).catch(DEFAULT_SETTINGS.gyroRange),
  invertY: z.boolean().catch(DEFAULT_SETTINGS.invertY),
  invertLookY: z.boolean().catch(DEFAULT_SETTINGS.invertLookY),
  mouseSteer: z.boolean().catch(DEFAULT_SETTINGS.mouseSteer),
  lookSpeed: z.number().min(0.3).max(2.5).catch(DEFAULT_SETTINGS.lookSpeed),
  sticks: sticksSchema,
  bindings: bindingsSchema,
  reducedMotion: z.boolean().catch(DEFAULT_SETTINGS.reducedMotion),
  vibration: z.boolean().catch(DEFAULT_SETTINGS.vibration),
  showFps: z.boolean().catch(DEFAULT_SETTINGS.showFps),
  checkUpdates: z.boolean().catch(DEFAULT_SETTINGS.checkUpdates),
  updatesAsked: z.boolean().catch(DEFAULT_SETTINGS.updatesAsked),
})

/** One time a treasure was found: when, whether shiny, and where the ride led. */
const findEventSchema = z.object({
  at: z.number(),
  shiny: z.boolean(),
  world: z.string().optional(),
  tier: z.number().int().min(1).max(4).optional(),
  distance: z.number().min(0).optional(),
})

/** How many finds of each treasure the save remembers in detail. */
export const HISTORY_LIMIT = 50

const findSchema = z.object({
  count: z.number().int().min(0),
  shiny: z.number().int().min(0),
  /** When it was first found, in ms since 1970. */
  first: z.number(),
  /** The latest finds, oldest first. Saves from before it was kept have none. */
  history: z.array(findEventSchema).max(HISTORY_LIMIT).optional(),
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

/** The format of an exported save file. */
export const SAVE_FORMAT = 'vibe-wormholesurfing-save'

/** A save as a file to keep: the record and when it was exported. */
export function exportSave(save: Save, now = new Date()): string {
  return `${JSON.stringify({ format: SAVE_FORMAT, exportedAt: now.toISOString(), save }, null, 2)}\n`
}

/**
 * The save in an exported file, or undefined when the file is not one: another format, broken
 * JSON or a save that does not read. Settings that do not read fall back to their defaults.
 */
export function importSave(text: string): Save | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object') return undefined
  const file = parsed as { format?: unknown; save?: unknown }
  if (file.format !== SAVE_FORMAT) return undefined
  const result = saveSchema.safeParse(file.save)
  return result.success ? result.data : undefined
}
export type Find = z.infer<typeof findSchema>
export type FindEvent = z.infer<typeof findEventSchema>

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
  async addFind(
    reward: Reward,
    now = Date.now(),
    where: { world?: WorldId; tier?: HoleTier; distance?: number } = {},
  ): Promise<{ fresh: boolean; count: number }> {
    const before = this.#save.collection[reward.item.id]
    const event: FindEvent = { at: now, shiny: reward.shiny, ...where }
    const find: Find = {
      count: (before?.count ?? 0) + 1,
      shiny: (before?.shiny ?? 0) + (reward.shiny ? 1 : 0),
      first: before?.first ?? now,
      history: [...(before?.history ?? []), event].slice(-HISTORY_LIMIT),
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

  /** Puts an imported save in place of this one, settings included. */
  replace(save: Save): Promise<void> {
    return this.update(() => save)
  }

  /** Forgets every treasure and record, keeping the settings. */
  reset(): Promise<void> {
    return this.update((save) => ({ ...freshSave(), settings: save.settings }))
  }

  saved(): Promise<void> {
    return this.#queue.saved()
  }
}
