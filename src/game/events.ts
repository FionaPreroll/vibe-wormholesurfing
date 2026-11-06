/** Things that happen in the game, for sound and buzzes to follow. */
export type GameEvent =
  | { readonly type: 'orb'; readonly combo: number }
  | { readonly type: 'spark' }
  | { readonly type: 'holeAppears'; readonly tier: number }
  | { readonly type: 'captured' }
  | { readonly type: 'enter'; readonly tier: number }
  | { readonly type: 'arrive' }
  | { readonly type: 'jump' }
  | { readonly type: 'land' }
  | { readonly type: 'step'; readonly wet: boolean }
  | { readonly type: 'open' }
  | { readonly type: 'reveal'; readonly rarity: number; readonly shiny: boolean }
  | { readonly type: 'click' }

type Listener = (event: GameEvent) => void

const listeners = new Set<Listener>()

/** Tells every listener what happened. */
export function emit(event: GameEvent): void {
  for (const listener of listeners) listener(event)
}

/** Listens to everything that happens; returns a function that stops listening. */
export function onGameEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
