import { ITEMS } from '../core/rewards'
import { number, t } from '../i18n'
import type { Save } from '../persistence/save'
import { FullScreenButton } from './FullScreen'

interface Props {
  readonly save: Save
  readonly ready: boolean
  readonly onPlay: () => void
  readonly onCollection: () => void
  readonly onHelp: () => void
  readonly onSettings: () => void
  readonly onAbout: () => void
}

export function TitleScreen({
  save,
  ready,
  onPlay,
  onCollection,
  onHelp,
  onSettings,
  onAbout,
}: Props) {
  const found = Object.keys(save.collection).length
  const shiny = Object.values(save.collection).filter((find) => find.shiny > 0).length
  return (
    <div class="title-screen">
      <div class="title-block">
        <h1 class="logo">
          <span class="logo-top">Wormhole</span>
          <span class="logo-bottom">Surfing</span>
        </h1>
        <p class="tagline">{t('tagline')}</p>
      </div>
      <nav class="title-menu">
        <button type="button" class="primary big" onClick={onPlay} disabled={!ready}>
          {ready ? t('play') : t('loading')}
        </button>
        <button type="button" onClick={onCollection}>
          {t('collection')}
        </button>
        <button type="button" onClick={onHelp}>
          {t('help')}
        </button>
        <button type="button" onClick={onSettings}>
          {t('settings')}
        </button>
      </nav>
      <footer class="title-footer">
        <span>{t('foundCount', { found, total: ITEMS.length })}</span>
        {shiny > 0 && <span>{t('shinyCount', { count: shiny })}</span>}
        {save.stats.bestDistance > 0 && (
          <span>{t('bestDistance', { distance: number(save.stats.bestDistance) })}</span>
        )}
        <FullScreenButton />
        <button type="button" class="ghost small" onClick={onAbout}>
          {t('about')}
        </button>
      </footer>
    </div>
  )
}
