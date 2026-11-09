import { useState } from 'preact/hooks'
import type { DebugReport } from '../game/debugLog'
import {
  QUALITIES,
  type Quality,
  SEE_THROUGH,
  type SeeThrough,
  type Settings,
} from '../game/settings'
import { type MessageKey, t } from '../i18n'
import { PAD, type PadStyle } from '../input/gamepad'
import type { GyroState } from '../input/gyro'
import type { StoredLog } from '../persistence/logs'
import type { Save } from '../persistence/save'
import { checkForUpdate, offer } from './appUpdates'
import { padButtonName } from './controlNames'
import { DebugTools, SaveTools } from './DataTools'
import { isDesktop } from './desktop'
import { checkDesktopUpdate, desktopUpdate, downloadDesktopUpdate } from './desktopUpdates'
import { Choice, Slider, Toggle } from './fields'
import { LanguageSwitch } from './LanguageSwitch'
import { Modal } from './Modal'
import { isApp } from './native'

const SEE_THROUGH_NAMES: Readonly<Record<SeeThrough, MessageKey>> = {
  auto: 'seeThroughAuto',
  on: 'seeThroughOn',
  off: 'seeThroughOff',
}

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
  /** Opens the controller's sticks and the keys and buttons. */
  readonly onControls: () => void
  readonly onClose: () => void
}

/** What looking for a new version now found: a line for the player, and what to download. */
interface Looked {
  readonly status?: string
  readonly download?: () => void
}

/** The Android app: a newer build opens the library's dialog, which downloads and installs it. */
async function lookInAndroidApp(): Promise<Looked> {
  const check = await checkForUpdate()
  if (check.kind === 'newer') {
    offer(check.release)
    return {}
  }
  return {
    status:
      check.kind === 'current'
        ? t('updatesCurrent', { build: check.installed })
        : t('updatesCheckFailed'),
  }
}

/** The desktop app: a newer build is said, with its download, which the browser opens. */
async function lookInDesktopApp(): Promise<Looked> {
  const check = await checkDesktopUpdate()
  if (check.kind === 'newer') {
    desktopUpdate.value = check.build
    return {
      status: t('updateReady', { build: check.build }),
      download: () => downloadDesktopUpdate(),
    }
  }
  return {
    status:
      check.kind === 'current'
        ? t('updatesCurrent', { build: check.installed })
        : t('updatesCheckFailed'),
  }
}

/**
 * The app's updates, in the Android app and the desktop app: whether to look at every start, and
 * looking now, which offers what it finds whatever the switch says.
 */
function AppUpdateSettings({
  checked,
  onChange,
  note,
  look,
}: {
  readonly checked: boolean
  readonly onChange: (on: boolean) => void
  /** Where new versions come from, and how they install. */
  readonly note: string
  readonly look: () => Promise<Looked>
}) {
  const [found, setFound] = useState<Looked>({})
  const [looking, setLooking] = useState(false)
  const lookNow = async () => {
    setLooking(true)
    setFound({ status: t('updatesChecking') })
    setFound(await look())
    setLooking(false)
  }
  const download = found.download
  return (
    <>
      <h3>{t('updatesSection')}</h3>
      <Toggle label={t('updatesSetting')} checked={checked} onChange={onChange} />
      <p class="note">{note}</p>
      <div class="tool-buttons">
        <button type="button" disabled={looking} onClick={() => void lookNow()}>
          {t('updatesCheckNow')}
        </button>
        {download && (
          <button
            type="button"
            class="primary"
            onClick={() => {
              download()
              setFound({ status: t('desktopUpdateStarted') })
            }}
          >
            {t('updateDownload')}
          </button>
        )}
      </div>
      {found.status && (
        <p class="note" role="status">
          {found.status}
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
  onControls,
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
        <h3>{t('displaySection')}</h3>
        <Choice
          label={t('seeThrough')}
          value={settings.seeThrough}
          options={SEE_THROUGH.map((choice) => ({
            value: choice,
            label: t(SEE_THROUGH_NAMES[choice]),
          }))}
          onChange={(seeThrough) => set({ seeThrough })}
        />
        <Slider
          label={t('hudScale', { value: settings.hudScale.toFixed(1) })}
          value={settings.hudScale}
          min={0.2}
          max={4}
          step={0.1}
          onInput={(hudScale) => set({ hudScale })}
        />
        <Slider
          label={t('menuScale', { value: settings.menuScale.toFixed(1) })}
          value={settings.menuScale}
          min={0.5}
          max={2}
          step={0.1}
          onInput={(menuScale) => set({ menuScale })}
          onRelease
        />
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
        <Toggle
          label={t('noseHitbox')}
          checked={settings.noseHitbox}
          onChange={(noseHitbox) => set({ noseHitbox })}
        />
        <Toggle
          label={t('invertLookY')}
          checked={settings.invertLookY}
          onChange={(invertLookY) => set({ invertLookY })}
        />
        <Slider
          label={t('lookSpeed')}
          value={settings.lookSpeed}
          min={0.4}
          max={2}
          step={0.1}
          onInput={(lookSpeed) => set({ lookSpeed })}
        />
        <button type="button" onClick={onControls}>
          {t('controlsButton')}
        </button>
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
            note={t('updatesNote')}
            look={lookInAndroidApp}
          />
        )}
        {isDesktop() && (
          <AppUpdateSettings
            checked={settings.checkUpdates}
            onChange={(checkUpdates) => set({ checkUpdates, updatesAsked: true })}
            note={t('desktopUpdatesNote')}
            look={lookInDesktopApp}
          />
        )}
        <h3>{t('backupSection')}</h3>
        <SaveTools save={save} onImport={onImport} />
        <h3>{t('debugTitle')}</h3>
        <Toggle
          label={t('showHitboxes')}
          checked={settings.showHitboxes}
          onChange={(showHitboxes) => set({ showHitboxes })}
        />
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

export function HelpDialog({
  padStyle,
  onClose,
}: {
  readonly padStyle: PadStyle
  readonly onClose: () => void
}) {
  const name = (button: number) => padButtonName(button, padStyle)
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
        <p>
          {t('helpPadText', {
            a: name(PAD.a),
            b: name(PAD.b),
            y: name(PAD.y),
            lb: name(PAD.lb),
            rb: name(PAD.rb),
            start: name(PAD.start),
          })}
        </p>
        <h3>{t('helpTouch')}</h3>
        <p>{t('helpTouchText')}</p>
        <h3>{t('helpGyro')}</h3>
        <p>{t('helpGyroText')}</p>
        <p class="note">{t('helpRemap')}</p>
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
