import { itemById, RARITIES } from '../core/rewards'
import { isWorldId } from '../core/worlds'
import { dateTime, itemDescription, itemName, number, rarityName, t, worldName } from '../i18n'
import type { Find } from '../persistence/save'
import { Modal } from './Modal'

const RARITY_CSS = ['#cfd8e6', '#6fe08a', '#4fb0ff', '#c77dff', '#ffcf4a']

interface Props {
  readonly id: string
  readonly find: Find
  readonly picture: string | undefined
  readonly onClose: () => void
}

/** A found treasure up close: its picture, rarity, world, description and every time it was found. */
export function ItemDialog({ id, find, picture, onClose }: Props) {
  const item = itemById(id)
  if (!item) return null
  const rarity = RARITIES.indexOf(item.rarity)
  const history = find.history ?? []
  const earlier = find.count - history.length
  return (
    <Modal id="item" title={itemName(id)} onClose={onClose}>
      <div class={`item-details rarity-${item.rarity}${find.shiny > 0 ? ' shiny' : ''}`}>
        <div class="item-hero" style={{ '--rarity': RARITY_CSS[rarity] }}>
          {picture && <img src={picture} alt="" width={180} height={180} />}
          <div>
            <p class="item-rarity">
              {'★'.repeat(rarity + 1)} {rarityName(item.rarity)}
            </p>
            <p class="item-world">{worldName(item.world)}</p>
            <p class="item-count">
              {find.count === 1 ? t('itemFoundOnce') : t('itemFoundTimes', { count: find.count })}
              {find.shiny > 0 && <> · {t('itemShinyTimes', { count: find.shiny })}</>}
            </p>
            <p class="note">{t('itemFirstFound', { date: dateTime(find.first) })}</p>
          </div>
        </div>
        <p class="item-description">{itemDescription(id)}</p>
        <h3>{t('itemFinds')}</h3>
        <ol class="find-list" reversed>
          {[...history].reverse().map((event) => (
            <li key={event.at}>
              <span class="find-date">{dateTime(event.at)}</span>
              {event.distance !== undefined &&
                event.world !== undefined &&
                isWorldId(event.world) && (
                  <span class="find-where">
                    {t('itemFindLine', {
                      distance: number(event.distance),
                      world: worldName(event.world),
                    })}
                  </span>
                )}
              {event.tier !== undefined && <span class="find-tier">{'✦'.repeat(event.tier)}</span>}
              {event.shiny && <span class="badge shiny">{t('itemShinyMark')}</span>}
            </li>
          ))}
        </ol>
        {earlier > 0 && <p class="note">{t('itemEarlierFinds', { count: earlier })}</p>}
      </div>
    </Modal>
  )
}
