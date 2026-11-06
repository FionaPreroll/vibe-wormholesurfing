/** A source of numbers in [0, 1), as Math.random gives them. */
export type Random = () => number

/**
 * A fast seeded generator (mulberry32), so a ride or a world plays the same for the same seed and
 * tests can count on their numbers.
 */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A seed from the clock and Math.random, for rides that need not repeat. */
export function freshSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0
}

/** A number in [min, max). */
export function between(random: Random, min: number, max: number): number {
  return min + (max - min) * random()
}

/** One of the entries, each as likely as its weight. Entries of weight 0 never come up. */
export function pickWeighted<T>(random: Random, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)
  if (entries.length === 0 || total <= 0) throw new Error('pickWeighted needs a positive weight')
  let roll = random() * total
  for (const [value, weight] of entries) {
    if (weight <= 0) continue
    roll -= weight
    if (roll < 0) return value
  }
  // Rounding can leave a sliver at the end: the last entry with weight takes it.
  const last = [...entries].reverse().find(([, weight]) => weight > 0)
  return (last as readonly [T, number])[0]
}

/** A point spread evenly over a disc of the given radius. */
export function inDisc(random: Random, radius: number): { x: number; y: number } {
  const angle = random() * Math.PI * 2
  const distance = Math.sqrt(random()) * radius
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
}
