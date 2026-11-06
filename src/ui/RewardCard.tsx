import { RARITIES } from '../core/rewards'
import type { Found } from '../game/hud'
import { itemName, number, rarityName, t, worldName } from '../i18n'

const RARITY_CSS = ['#cfd8e6', '#6fe08a', '#4fb0ff', '#c77dff', '#ffcf4a']

interface Props {
  readonly found: Found
  readonly picture: string | undefined
  readonly onFlyAgain: () => void
  readonly onCollection: () => void
  readonly onTitle: () => void
}

/** What the treasure held: its name and rarity, whether it is new, and where to go next. */
export function RewardCard({ found, picture, onFlyAgain, onCollection, onTitle }: Props) {
  const { reward } = found
  const rarity = RARITIES.indexOf(reward.item.rarity)
  const color = RARITY_CSS[rarity] ?? '#ffffff'
  return (
    <div class="reward-backdrop">
      <div
        class={`reward-card rarity-${reward.item.rarity}${reward.shiny ? ' shiny' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-name"
        style={{ '--rarity': color }}
      >
        <div class="reward-rays" aria-hidden="true" />
        <p class="reward-rarity">{rarityName(reward.item.rarity)}</p>
        {picture && <img class="reward-picture" src={picture} alt="" width={160} height={160} />}
        <h2 id="reward-name">{itemName(reward.item.id)}</h2>
        <p class="reward-meta">
          {worldName(found.world)} · {'✦'.repeat(found.tier)} ·{' '}
          {t('distanceFlown', { distance: number(found.distance) })}
        </p>
        <div class="reward-badges">
          {found.fresh ? (
            <span class="badge new">{t('newFind')}</span>
          ) : (
            <span class="badge">{t('foundAgain', { count: found.count })}</span>
          )}
          {reward.shiny && <span class="badge shiny">{t('shiny')}</span>}
        </div>
        <div class="actions">
          <button type="button" class="primary" onClick={onFlyAgain}>
            {t('flyAgain')}
          </button>
          <button type="button" onClick={onCollection}>
            {t('collection')}
          </button>
          <button type="button" class="ghost" onClick={onTitle}>
            {t('toTitle')}
          </button>
        </div>
      </div>
    </div>
  )
}
