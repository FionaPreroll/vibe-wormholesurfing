import { useEffect, useState } from 'preact/hooks'
import changelog from '../../CHANGELOG.md?raw'
import { version } from '../../package.json'
import type { DebugReport } from '../game/debugLog'
import { t } from '../i18n'
import type { StoredLog } from '../persistence/logs'
import type { Save } from '../persistence/save'
import { appBuild } from './appUpdates'
import { renderChangelog } from './changelog'
import { DebugTools, SaveTools } from './DataTools'
import { install, installPrompt, runsAsApp } from './install'
import { ANDROID_RELEASE, APK_URL, CONTACT_EMAIL, ISSUES_URL, SOURCE_URL, WEB_URL } from './links'
import { isApp } from './native'

interface Props {
  readonly save: Save
  readonly onImport: (save: Save) => Promise<void>
  readonly debugReport: () => DebugReport
  readonly debugSummary: string
  readonly savedLogs?: readonly StoredLog[]
  readonly session?: string
  readonly graphics: readonly string[]
  readonly onBack: () => void
}

/** The version of the Android app installed, once the app has said. */
function AppVersion() {
  const [version, setVersion] = useState<string>()
  useEffect(() => {
    void appBuild().then((build) => {
      if (build) setVersion(t('appVersion', { name: build.name }))
    })
  }, [])
  return version ? <p class="note">{version}</p> : null
}

/** The way from the web version to the app, or from the app back to the web version. */
function WebAndApp() {
  if (runsAsApp()) {
    return (
      <>
        <p>{t('playingInApp')}</p>
        {isApp() && <AppVersion />}
        <p>
          <a class="link-button" href={WEB_URL} target="_blank" rel="noreferrer">
            {t('openWeb')}
          </a>
        </p>
      </>
    )
  }
  return (
    <>
      <p>{t('playingInBrowser')}</p>
      <h3>{t('androidApp')}</h3>
      <p>{t('androidAppText')}</p>
      <div class="tool-buttons">
        <a class="link-button" href={APK_URL}>
          {t('androidDownload')}
        </a>
        <a class="link-button" href={ANDROID_RELEASE} target="_blank" rel="noreferrer">
          {t('androidRelease')}
        </a>
      </div>
      <h3>{t('installApp')}</h3>
      {installPrompt.value ? (
        <p>
          <button type="button" onClick={() => void install()}>
            {t('installApp')}
          </button>
        </p>
      ) : (
        <p class="note">{t('installHint')}</p>
      )}
    </>
  )
}

/** What the game is, how it is made, the player's data, the debug log and the changelog. */
export function AboutScreen({
  save,
  onImport,
  debugReport,
  debugSummary,
  savedLogs,
  session,
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
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              {t('sourceCode')}
            </a>
          </p>
        </section>
        <section class="about-card">
          <h2>{t('appTitleSection')}</h2>
          <WebAndApp />
        </section>
        <section class="about-card">
          <h2>{t('contactTitle')}</h2>
          <p>{t('contactText')}</p>
          <ul class="contact">
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </li>
            <li>
              <a href={ISSUES_URL} target="_blank" rel="noreferrer">
                {t('issueTracker')}
              </a>
            </li>
          </ul>
        </section>
        <section class="about-card">
          <h2>{t('aboutMadeTitle')}</h2>
          <p>{t('aboutMade')}</p>
          <p>
            {t('aboutFonts')}{' '}
            <a href="https://openfontlicense.org/" target="_blank" rel="noreferrer">
              OFL
            </a>
          </p>
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
          <DebugTools
            report={debugReport}
            summary={debugSummary}
            saved={savedLogs}
            session={session}
          />
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
