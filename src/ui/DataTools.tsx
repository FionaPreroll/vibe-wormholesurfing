import { useState } from 'preact/hooks'
import type { DebugReport } from '../game/debugLog'
import { dateTime, t } from '../i18n'
import type { StoredLog } from '../persistence/logs'
import { exportSave, importSave, type Save } from '../persistence/save'
import { downloadFile } from './download'
import { FileButton } from './FileButton'
import { issueUrl, mailUrl } from './report'

/** The date for file names, as 2026-11-06. */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface SaveToolsProps {
  readonly save: Save
  readonly onImport: (save: Save) => Promise<void>
}

/** Export the save to a file, or import one in its place. */
export function SaveTools({ save, onImport }: SaveToolsProps) {
  const [message, setMessage] = useState<string>()
  return (
    <div class="tools">
      <div class="tool-buttons">
        <button
          type="button"
          onClick={() => downloadFile(`wormhole-surfing-save-${today()}.json`, exportSave(save))}
        >
          {t('exportSave')}
        </button>
        <FileButton
          label={t('importSave')}
          onFile={(file) => {
            void file.text().then(async (text) => {
              const imported = importSave(text)
              if (!imported) {
                setMessage(t('importFailed'))
                return
              }
              if (!confirm(t('importConfirm'))) return
              await onImport(imported)
              setMessage(t('importDone'))
            })
          }}
        />
      </div>
      {message && (
        <p class="note" role="status">
          {message}
        </p>
      )}
    </div>
  )
}

interface DebugToolsProps {
  /** The debug report of this session, made when asked for. */
  readonly report: () => DebugReport
  readonly summary: string
  /** Logs of the latest sessions that the browser kept, when shown. */
  readonly saved?: readonly StoredLog[]
  readonly session?: string
}

const asFile = (report: DebugReport) => `${JSON.stringify(report, null, 2)}\n`

/** How long a kept session ran, as 40 s or 12 min. */
export function sessionLength(log: StoredLog): string {
  const seconds = Math.max(
    0,
    Math.round((Date.parse(log.savedAt) - Date.parse(log.report.openedAt)) / 1000),
  )
  return seconds < 90 ? `${seconds} s` : `${Math.round(seconds / 60)} min`
}

/** Export, copy or report the debug log, and export the logs of earlier sessions. */
export function DebugTools({ report, summary, saved, session }: DebugToolsProps) {
  const [copied, setCopied] = useState(false)
  const [reported, setReported] = useState(false)
  const save = (current: DebugReport, date = today()) =>
    downloadFile(`wormhole-surfing-debug-${date}.json`, asFile(current))
  return (
    <div class="tools">
      <p class="note">{summary}</p>
      <div class="tool-buttons">
        <button type="button" onClick={() => save(report())}>
          {t('exportDebug')}
        </button>
        {typeof navigator !== 'undefined' && navigator.clipboard && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(asFile(report())).then(() => setCopied(true))
            }}
          >
            {copied ? t('copied') : t('copyDebug')}
          </button>
        )}
      </div>
      <div class="tool-buttons">
        <a
          class="link-button"
          href={issueUrl(report())}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            save(report())
            setReported(true)
          }}
        >
          {t('reportIssue')}
        </a>
        <a
          class="link-button"
          href={mailUrl(report())}
          onClick={() => {
            save(report())
            setReported(true)
          }}
        >
          {t('reportEmail')}
        </a>
      </div>
      {reported && (
        <p class="note" role="status">
          {t('reportHint')}
        </p>
      )}
      {saved && saved.length > 0 && (
        <>
          <h3>{t('savedLogs')}</h3>
          <p class="note">{t('savedLogsText')}</p>
          <ul class="saved-logs">
            {saved.map((log) => (
              <li key={log.id}>
                <span>
                  {t('savedLogLine', {
                    date: dateTime(Date.parse(log.report.openedAt)),
                    length: sessionLength(log),
                    glitches: Number(log.report.summary.glitches ?? 0),
                    errors: Number(log.report.summary.errors ?? 0),
                  })}
                  {log.id === session && <> · {t('thisSession')}</>}
                </span>
                <button
                  type="button"
                  class="small"
                  onClick={() => save(log.report, log.id.slice(0, 10))}
                >
                  {t('exportLog')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
