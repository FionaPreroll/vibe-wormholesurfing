import changelog from '../../CHANGELOG.md?raw'
import { version } from '../../package.json'
import { t } from '../i18n'
import type { Save } from '../persistence/save'
import { renderChangelog } from './changelog'
import { DebugTools, SaveTools } from './DataTools'

const SOURCE = 'https://github.com/FionaPreroll/vibe-wormholesurfing'

interface Props {
  readonly save: Save
  readonly onImport: (save: Save) => Promise<void>
  readonly debugReport: () => string
  readonly debugSummary: string
  readonly graphics: readonly string[]
  readonly onBack: () => void
}

/** What the game is, how it is made, the player's data, the debug log and the changelog. */
export function AboutScreen({
  save,
  onImport,
  debugReport,
  debugSummary,
  graphics,
  onBack,
}: Props) {
  return (
    <section class="panel-screen about" aria-labelledby="about-title">
      <header class="panel-header">
        <button type="button" class="ghost" onClick={onBack}>
          ← {t('back')}
        </button>
        <h1 id="about-title">{t('aboutTitle')}</h1>
        <p>{t('version', { version })}</p>
      </header>
      <div class="about-body">
        <section class="about-card">
          <h2>{t('appTitle')}</h2>
          <p>{t('aboutText')}</p>
          <p>{t('aboutRuns')}</p>
          <p>
            <a href={SOURCE} target="_blank" rel="noreferrer">
              {t('sourceCode')}
            </a>
          </p>
        </section>
        <section class="about-card">
          <h2>{t('aboutMadeTitle')}</h2>
          <p>{t('aboutMade')}</p>
          {graphics.map((line) => (
            <p key={line} class="note">
              {line}
            </p>
          ))}
        </section>
        <section class="about-card">
          <h2>{t('dataTitle')}</h2>
          <p>{t('dataText')}</p>
          <SaveTools save={save} onImport={onImport} />
        </section>
        <section class="about-card">
          <h2>{t('debugTitle')}</h2>
          <p>{t('debugText')}</p>
          <DebugTools report={debugReport} summary={debugSummary} />
        </section>
        <section class="about-card changelog">
          <h2>{t('changes')}</h2>
          <p class="note">{t('changesInEnglish')}</p>
          <div lang="en">{renderChangelog(changelog)}</div>
        </section>
      </div>
    </section>
  )
}
