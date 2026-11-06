import { useEffect, useState } from 'preact/hooks'
import { ITEMS, itemsOf, RARITIES } from '../core/rewards'
import { WORLD_IDS } from '../core/worlds'
import { itemName, rarityName, t, worldName } from '../i18n'
import type { Save } from '../persistence/save'

interface Props {
  readonly collection: Save['collection']
  readonly thumbnail: ((id: string, shiny: boolean) => string) | undefined
  readonly onBack: () => void
}

/** Every treasure of every world: found ones with their picture and count, the rest unknown. */
export function CollectionScreen({ collection, thumbnail, onBack }: Props) {
  const found = Object.keys(collection).length
  const [pictures, setPictures] = useState<Record<string, string>>({})
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
    <section class="panel-screen collection" aria-labelledby="collection-title">
      <header class="panel-header">
        <button type="button" class="ghost" onClick={onBack}>
          ← {t('back')}
        </button>
        <h1 id="collection-title">{t('collectionTitle')}</h1>
        <p>{t('collectionProgress', { found, total: ITEMS.length })}</p>
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
                    class={`slot rarity-${item.rarity}${find ? ' known' : ''}${find && find.shiny > 0 ? ' shiny' : ''}`}
                  >
                    <div class="slot-picture">
                      {find && pictures[item.id] ? (
                        <img src={pictures[item.id]} alt="" />
                      ) : (
                        <span aria-hidden="true">{find ? '…' : '?'}</span>
                      )}
                    </div>
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
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}
