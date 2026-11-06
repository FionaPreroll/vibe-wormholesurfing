import { useState } from 'preact/hooks'
import { t } from '../i18n'
import { exportSave, importSave, type Save } from '../persistence/save'
import { downloadFile } from './download'
import { FileButton } from './FileButton'

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
  /** The debug report as text, made when asked for. */
  readonly report: () => string
  readonly summary: string
}

/** Export the debug log to a file, or copy it to paste into a message. */
export function DebugTools({ report, summary }: DebugToolsProps) {
  const [copied, setCopied] = useState(false)
  return (
    <div class="tools">
      <p class="note">{summary}</p>
      <div class="tool-buttons">
        <button
          type="button"
          onClick={() => downloadFile(`wormhole-surfing-debug-${today()}.json`, report())}
        >
          {t('exportDebug')}
        </button>
        {typeof navigator !== 'undefined' && navigator.clipboard && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(report()).then(() => setCopied(true))
            }}
          >
            {copied ? t('copied') : t('copyDebug')}
          </button>
        )}
      </div>
    </div>
  )
}
