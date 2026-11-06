import type { Land } from './land'
import { LANDING_RADIUS } from './land'
import type { PropKind, PropRule, WorldLayout } from './layouts'
import { between, type Random } from './random'

/** One piece of scenery, standing on the ground. */
export interface Prop {
  readonly kind: PropKind
  readonly x: number
  readonly z: number
  /** Height of the ground under it. */
  readonly y: number
  readonly scale: number
  /** Turn around the vertical axis. */
  readonly yaw: number
  /** Walking stops this far from its middle; 0 to walk through. */
  readonly block: number
}

/** A circle that the player cannot walk into. */
export interface Blocker {
  readonly x: number
  readonly z: number
  readonly radius: number
}

const SIZE = 125

/**
 * Spreads every prop rule over the land. Props that block walking keep clear of the landing site
 * and of each other; the rest may stand anywhere their rule allows.
 */
export function scatterProps(random: Random, land: Land, layout: WorldLayout): Prop[] {
  const props: Prop[] = []
  const blockers: Prop[] = []
  for (const rule of layout.props) {
    let placed = 0
    for (let tries = 0; placed < rule.count && tries < rule.count * 12; tries++) {
      const prop = tryPlace(random, land, rule, blockers)
      if (!prop) continue
      props.push(prop)
      if (prop.block > 0) blockers.push(prop)
      placed++
    }
  }
  return props
}

function tryPlace(
  random: Random,
  land: Land,
  rule: PropRule,
  blockers: readonly Prop[],
): Prop | undefined {
  const from = rule.from ?? 4
  const to = rule.to ?? SIZE
  const angle = random() * Math.PI * 2
  // Even spread over the ring's area, not crowded toward its middle.
  const distance = Math.sqrt(between(random, from * from, to * to))
  const x = Math.cos(angle) * distance
  const z = Math.sin(angle) * distance
  const y = land.heightAt(x, z)
  const water = land.shape.water
  if (water !== undefined) {
    if (rule.underwater ? y > water - 0.3 : y < water + 0.15) return undefined
  } else if (rule.underwater) {
    return undefined
  }
  if (land.shape.rim < 0 && distance > land.shape.rimFrom + 2) return undefined
  // Small plants keep off the steep mountains around the valley, where they would float in the haze.
  if (rule.block === 0 && rule.to === undefined && distance > land.shape.rimFrom + 6)
    return undefined
  const scale = between(random, rule.scale[0], rule.scale[1])
  const block = rule.block * scale
  if (block > 0) {
    if (distance < LANDING_RADIUS + block + 2) return undefined
    if (land.slopeAt(x, z) > 1.4) return undefined
    for (const other of blockers) {
      const gap = block + other.block + 1.6
      if ((other.x - x) ** 2 + (other.z - z) ** 2 < gap * gap) return undefined
    }
  }
  return { kind: rule.kind, x, z, y, scale, yaw: random() * Math.PI * 2, block }
}

export function blockersOf(props: readonly Prop[]): Blocker[] {
  return props
    .filter((prop) => prop.block > 0)
    .map((prop) => ({ x: prop.x, z: prop.z, radius: prop.block }))
}
