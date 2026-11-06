import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { ITEMS, itemsOf, RARITIES } from '../core/rewards'
import { WORLD_IDS } from '../core/worlds'
import { itemName, rarityName, t, worldName } from '../i18n'
import type { Save } from '../persistence/save'
import { ItemDialog } from './ItemDialog'

/** A treasure on its way from the reward card into its place in the collection. */
export interface Flight {
  readonly id: string
  readonly picture: string
  /** Where the picture was on the card. */
  readonly from: DOMRect
}

interface Props {
  readonly collection: Save['collection']
  readonly thumbnail: ((id: string, shiny: boolean) => string) | undefined
  readonly onBack: () => void
  /** Treasures found since the collection was last opened; they pop into place. */
  readonly arriving?: readonly string[]
  readonly flight?: Flight
  readonly reducedMotion?: boolean
  /** Called once the new treasures are in place. */
  readonly onArrived?: () => void
  readonly onShare?: () => void
  readonly shareMessage?: string
}

/** Every treasure of every world: found ones with their picture and count, the rest unknown. */
export function CollectionScreen({
  collection,
  thumbnail,
  onBack,
  arriving = [],
  flight,
  reducedMotion = false,
  onArrived,
  onShare,
  shareMessage,
}: Props) {
  const root = useRef<HTMLElement>(null)
  const [flying, setFlying] = useState<string | undefined>(flight?.id)
  const [landed, setLanded] = useState<ReadonlySet<string>>(() =>
    flight ? new Set(arriving.filter((id) => id !== flight.id)) : new Set(arriving),
  )

  // The new treasure flies from where it was on the card into its slot, in an arc, and lands
  // with a pop; others found since the last visit pop in their places.
  useLayoutEffect(() => {
    if (!flight) {
      const timer = setTimeout(() => onArrived?.(), 1600)
      return () => clearTimeout(timer)
    }
    const slot = root.current?.querySelector<HTMLElement>(
      `[data-item="${flight.id}"] .slot-picture`,
    )
    if (!slot) {
      setFlying(undefined)
      onArrived?.()
      return
    }
    slot.scrollIntoView({ block: 'center' })
    const to = slot.getBoundingClientRect()
    const from = flight.from
    const flyer = document.createElement('img')
    flyer.src = flight.picture
    flyer.className = 'flyer'
    flyer.alt = ''
    Object.assign(flyer.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    })
    document.body.append(flyer)
    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    const scale = to.width / Math.max(1, from.width)
    const animation = flyer.animate(
      [
        { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
        {
          transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 140}px) scale(${((1 + scale) / 2) * 1.2}) rotate(-14deg)`,
          offset: 0.45,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)` },
      ],
      {
        duration: reducedMotion ? 1 : 1100,
        easing: 'cubic-bezier(0.45, 0, 0.25, 1)',
        fill: 'forwards',
      },
    )
    const land = () => {
      flyer.remove()
      setFlying(undefined)
      setLanded((before) => new Set([...before, flight.id]))
      onArrived?.()
    }
    animation.onfinish = land
    return () => {
      animation.cancel()
      flyer.remove()
    }
    // The flight starts once, when the screen opens.
  }, [])

  const found = Object.keys(collection).length
  const [pictures, setPictures] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string>()
  const openFind = open === undefined ? undefined : collection[open]
  useEffect(() => {
    if (!thumbnail) return
    // Pictures come one per frame, so the screen opens at once.
    let index = 0
    let frame = 0
    const ids = ITEMS.filter((item) => collection[item.id]).map((item) => item.id)
    const next = () => {
      const id = ids[index++]
      if (id === undefined) return
      const picture = thumbnail(id, (collection[id]?.shiny ?? 0) > 0)
      setPictures((before) => ({ ...before, [id]: picture }))
      frame = requestAnimationFrame(next)
    }
    frame = requestAnimationFrame(next)
    return () => cancelAnimationFrame(frame)
  }, [collection, thumbnail])
  return (
    <section class="panel-screen collection" aria-labelledby="collection-title" ref={root}>
      <header class="panel-header">
        <button type="button" class="ghost" onClick={onBack}>
          ← {t('back')}
        </button>
        <h1 id="collection-title">{t('collectionTitle')}</h1>
        <p>{t('collectionProgress', { found, total: ITEMS.length })}</p>
        {onShare && found > 0 && (
          <button type="button" class="primary share-button" onClick={onShare}>
            {t('shareCollection')}
          </button>
        )}
        {shareMessage && (
          <p class="note" role="status">
            {shareMessage}
          </p>
        )}
      </header>
      <div class="worlds">
        {WORLD_IDS.map((world) => (
          <section key={world} class={`world-row world-${world}`}>
            <h2>{worldName(world)}</h2>
            <ul>
              {itemsOf(world).map((item) => {
                const find = collection[item.id]
                const rarity = RARITIES.indexOf(item.rarity)
                return (
                  <li
                    key={item.id}
                    class={`slot rarity-${item.rarity}${find ? ' known' : ''}${find && find.shiny > 0 ? ' shiny' : ''}${landed.has(item.id) ? ' arrived' : ''}${flying === item.id ? ' awaiting' : ''}`}
                    style={
                      landed.has(item.id)
                        ? { animationDelay: `${arriving.indexOf(item.id) * 0.12}s` }
                        : undefined
                    }
                    data-item={item.id}
                  >
                    <button
                      type="button"
                      class="slot-button"
                      disabled={!find}
                      onClick={() => setOpen(item.id)}
                      aria-label={
                        find ? `${itemName(item.id)}, ${t('itemDetails')}` : t('unknownItem')
                      }
                    >
                      <span class="slot-picture">
                        {find && pictures[item.id] ? (
                          <img src={pictures[item.id]} alt="" />
                        ) : (
                          <span aria-hidden="true">{find ? '…' : '?'}</span>
                        )}
                      </span>
                      <span class="slot-name">{find ? itemName(item.id) : t('unknownItem')}</span>
                      <span class="slot-rarity">
                        {'★'.repeat(rarity + 1)} {rarityName(item.rarity)}
                      </span>
                      {find && (
                        <span class="slot-count">
                          {t('timesFound', { count: find.count })}
                          {find.shiny > 0 && <> · {t('shinyFound')}</>}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      {open && openFind && (
        <ItemDialog
          id={open}
          find={openFind}
          picture={thumbnail?.(open, openFind.shiny > 0)}
          onClose={() => setOpen(undefined)}
        />
      )}
    </section>
  )
}
