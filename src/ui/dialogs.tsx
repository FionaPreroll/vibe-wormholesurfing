import { useState } from 'preact/hooks'
import type { DebugReport } from '../game/debugLog'
import { QUALITIES, type Quality, type Settings } from '../game/settings'
import { type MessageKey, t } from '../i18n'
import type { GyroState } from '../input/gyro'
import type { StoredLog } from '../persistence/logs'
import type { Save } from '../persistence/save'
import { checkForUpdate, offer } from './appUpdates'
import { DebugTools, SaveTools } from './DataTools'
import { LanguageSwitch } from './LanguageSwitch'
import { Modal } from './Modal'
import { isApp } from './native'

const QUALITY_NAMES: Readonly<Record<Quality, MessageKey>> = {
  auto: 'qualityAuto',
  low: 'qualityLow',
  medium: 'qualityMedium',
  high: 'qualityHigh',
  ultra: 'qualityUltra',
}

const GYRO_STATES: Readonly<Record<GyroState, MessageKey>> = {
  off: 'gyroOff',
  on: 'gyroOn',
  waiting: 'gyroWaiting',
  denied: 'gyroDenied',
  unsupported: 'gyroUnsupported',
}

interface SettingsProps {
  readonly settings: Settings
  readonly save: Save
  readonly onImport: (save: Save) => Promise<void>
  readonly debugReport: () => DebugReport
  readonly debugSummary: string
  readonly savedLogs?: readonly StoredLog[]
  readonly session?: string
  readonly gyroState: GyroState
  readonly onChange: (settings: Settings) => void
  readonly onGyro: (on: boolean) => void
  readonly onReset: () => void
  readonly onClose: () => void
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onInput,
}: {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step: number
  readonly onInput: (value: number) => void
}) {
  return (
    <label class="field">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(event) => onInput(Number(event.currentTarget.value))}
      />
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  readonly label: string
  readonly checked: boolean
  readonly onChange: (on: boolean) => void
}) {
  return (
    <label class="field toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

/**
 * The Android app's updates: whether to look at every start, and looking now, which offers what
 * it finds whatever the switch says.
 */
function AppUpdateSettings({
  checked,
  onChange,
}: {
  readonly checked: boolean
  readonly onChange: (on: boolean) => void
}) {
  const [status, setStatus] = useState<string>()
  const [looking, setLooking] = useState(false)
  const look = async () => {
    setLooking(true)
    setStatus(t('updatesChecking'))
    const check = await checkForUpdate()
    setLooking(false)
    if (check.kind === 'newer') {
      setStatus(undefined)
      offer(check.release)
    } else {
      setStatus(
        check.kind === 'current'
          ? t('updatesCurrent', { build: check.installed })
          : t('updatesCheckFailed'),
      )
    }
  }
  return (
    <>
      <h3>{t('updatesSection')}</h3>
      <Toggle label={t('updatesSetting')} checked={checked} onChange={onChange} />
      <p class="note">{t('updatesNote')}</p>
      <div class="tool-buttons">
        <button type="button" disabled={looking} onClick={() => void look()}>
          {t('updatesCheckNow')}
        </button>
      </div>
      {status && (
        <p class="note" role="status">
          {status}
        </p>
      )}
    </>
  )
}

export function SettingsDialog({
  settings,
  save,
  onImport,
  debugReport,
  debugSummary,
  savedLogs,
  session,
  gyroState,
  onChange,
  onGyro,
  onReset,
  onClose,
}: SettingsProps) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch })
  return (
    <Modal id="settings" title={t('settingsTitle')} onClose={onClose}>
      <div class="settings">
        <Slider
          label={t('soundVolume')}
          value={settings.sound}
          min={0}
          max={1}
          step={0.05}
          onInput={(sound) => set({ sound })}
        />
        <Slider
          label={t('musicVolume')}
          value={settings.music}
          min={0}
          max={1}
          step={0.05}
          onInput={(music) => set({ music })}
        />
        <label class="field">
          <span>{t('quality')}</span>
          <select
            value={settings.quality}
            onChange={(event) => set({ quality: event.currentTarget.value as Quality })}
          >
            {QUALITIES.map((quality) => (
              <option key={quality} value={quality}>
                {t(QUALITY_NAMES[quality])}
              </option>
            ))}
          </select>
        </label>
        <LanguageSwitch />
        <h3>{t('controlsSection')}</h3>
        <Toggle label={t('gyro')} checked={settings.gyro} onChange={onGyro} />
        {settings.gyro && <p class="note">{t(GYRO_STATES[gyroState])}</p>}
        {settings.gyro && (
          <Slider
            label={t('gyroRange', { degrees: settings.gyroRange })}
            value={settings.gyroRange}
            min={10}
            max={40}
            step={1}
            onInput={(gyroRange) => set({ gyroRange })}
          />
        )}
        <Toggle
          label={t('mouseSteer')}
          checked={settings.mouseSteer}
          onChange={(mouseSteer) => set({ mouseSteer })}
        />
        <Toggle
          label={t('invertY')}
          checked={settings.invertY}
          onChange={(invertY) => set({ invertY })}
        />
        <Slider
          label={t('lookSpeed')}
          value={settings.lookSpeed}
          min={0.4}
          max={2}
          step={0.1}
          onInput={(lookSpeed) => set({ lookSpeed })}
        />
        <Toggle
          label={t('vibration')}
          checked={settings.vibration}
          onChange={(vibration) => set({ vibration })}
        />
        <Toggle
          label={t('reducedMotion')}
          checked={settings.reducedMotion}
          onChange={(reducedMotion) => set({ reducedMotion })}
        />
        <Toggle
          label={t('showFps')}
          checked={settings.showFps}
          onChange={(showFps) => set({ showFps })}
        />
        {isApp() && (
          <AppUpdateSettings
            checked={settings.checkUpdates}
            onChange={(checkUpdates) => set({ checkUpdates, updatesAsked: true })}
          />
        )}
        <h3>{t('backupSection')}</h3>
        <SaveTools save={save} onImport={onImport} />
        <h3>{t('debugTitle')}</h3>
        <DebugTools
          report={debugReport}
          summary={debugSummary}
          saved={savedLogs}
          session={session}
        />
        <button
          type="button"
          class="danger"
          onClick={() => {
            if (confirm(t('resetConfirm'))) onReset()
          }}
        >
          {t('resetSave')}
        </button>
      </div>
    </Modal>
  )
}

export function HelpDialog({ onClose }: { readonly onClose: () => void }) {
  return (
    <Modal id="help" title={t('helpTitle')} onClose={onClose}>
      <div class="help">
        <p>{t('helpGoal')}</p>
        <div class="tier-legend" aria-hidden="true">
          <span class="hole tier1" />
          <span class="hole tier2" />
          <span class="hole tier3" />
          <span class="hole tier4" />
        </div>
        <p>{t('helpHoles')}</p>
        <p>{t('helpPull')}</p>
        <p>{t('helpWorld')}</p>
        <h3>{t('helpKeyboard')}</h3>
        <p>{t('helpKeyboardText')}</p>
        <h3>{t('helpPad')}</h3>
        <p>{t('helpPadText')}</p>
        <h3>{t('helpTouch')}</h3>
        <p>{t('helpTouchText')}</p>
        <h3>{t('helpGyro')}</h3>
        <p>{t('helpGyroText')}</p>
      </div>
    </Modal>
  )
}

interface PauseProps {
  readonly inWorld: boolean
  readonly gyro: boolean
  readonly onResume: () => void
  readonly onRecenter: () => void
  readonly onSettings: () => void
  readonly onHelp: () => void
  readonly onQuit: () => void
}

export function PauseMenu({
  inWorld,
  gyro,
  onResume,
  onRecenter,
  onSettings,
  onHelp,
  onQuit,
}: PauseProps) {
  return (
    <Modal id="pause" title={t('paused')} onClose={onResume}>
      <div class="menu">
        <button type="button" class="primary" onClick={onResume}>
          {t('resume')}
        </button>
        {gyro && !inWorld && (
          <button type="button" onClick={onRecenter}>
            {t('recenter')}
          </button>
        )}
        <button type="button" onClick={onSettings}>
          {t('settings')}
        </button>
        <button type="button" onClick={onHelp}>
          {t('help')}
        </button>
        <button type="button" class="ghost" onClick={onQuit}>
          {t(inWorld ? 'leaveWorld' : 'quitRide')}
        </button>
      </div>
    </Modal>
  )
}
