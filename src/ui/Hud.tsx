import { useEffect, useState } from 'preact/hooks'
import { RIDE } from '../core/ride'
import type { WorldId } from '../core/worlds'
import { rideHud, worldHud } from '../game/hud'
import { settings } from '../game/settings'
import { number, t, worldName } from '../i18n'
import type { Input } from '../input/input'
import { touchScreen } from './pointer'

function PauseButton({ onPause }: { readonly onPause: () => void }) {
  return (
    <button type="button" class="round pause-button" aria-label={t('pause')} onClick={onPause}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1.5" />
        <rect x="14" y="5" width="4" height="14" rx="1.5" />
      </svg>
    </button>
  )
}

/** Rings where fingers rest, for the sticks of the touch controls. */
export function TouchSticks({ input }: { readonly input: Input }) {
  return (
    <div class="touch-layer" aria-hidden="true">
      {input.touches.value
        .filter((touch) => touch.kind === 'move')
        .map((touch) => (
          <div
            key={touch.id}
            class="stick"
            style={{
              left: `${touch.originX}px`,
              top: `${touch.originY}px`,
              width: `${touch.radius * 2}px`,
              height: `${touch.radius * 2}px`,
            }}
          >
            <div
              class="knob"
              style={{
                transform: `translate(${clampKnob(touch.x - touch.originX, touch.y - touch.originY, touch.radius).join('px, ')}px)`,
              }}
            />
          </div>
        ))}
    </div>
  )
}

function clampKnob(dx: number, dy: number, radius: number): [number, number] {
  const length = Math.hypot(dx, dy)
  const scale = length > radius ? radius / length : 1
  return [dx * scale, dy * scale]
}

/** Minutes and seconds, as 1:05. */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

/** A small table of numbers in a corner of the screen. */
function InfoPanel({ rows }: { readonly rows: readonly (readonly [string, string])[] }) {
  return (
    <dl class="info-panel">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

interface RideProps {
  readonly input: Input
  /** The farthest ride so far, in light-years. */
  readonly best: number
  readonly onPause: () => void
  readonly onRecenter: () => void
  readonly hint: boolean
  readonly onHintSeen: () => void
}

/** Over the ride: light-years, speed, the pull of holes, chains of orbs and the controls. */
export function RideHud({ input, best, onPause, onRecenter, hint, onHintSeen }: RideProps) {
  const hud = rideHud.value
  const speedShare = Math.min(1, hud.speed / 2.6)
  const pull = hud.captured ? 1 : hud.pull
  const gyro = settings.value.gyro && input.gyro.state.value === 'on'
  const source = input.source.value
  const how = gyro
    ? t('rideHintGyro')
    : source === 'gamepad'
      ? t('rideHintPad')
      : touchScreen.value
        ? t('rideHintTouch')
        : t('rideHintKeys')
  return (
    <div class={`hud ride-hud${hud.warping ? ' warping' : ''}`}>
      <div class="distance" aria-live="off">
        <span class="value">{number(hud.distance)}</span>
        <span class="unit">{t('lightYears')}</span>
      </div>
      <div class="speed" aria-hidden="true">
        <div class="speed-fill" style={{ width: `${speedShare * 100}%` }} />
        <div class="speed-safe" />
      </div>
      {pull > 0.35 && !hud.warping && (
        <div
          class={`pull${hud.captured ? ' captured' : ''}`}
          style={{ opacity: Math.min(1, pull + 0.2) }}
        >
          {t(hud.captured ? 'captured' : 'pullWarning')}
        </div>
      )}
      {hud.combo >= 2 && !hud.warping && (
        <div class="combo" key={hud.combo}>
          {t('combo', { count: hud.combo })}
        </div>
      )}
      {!hud.warping && (
        <InfoPanel
          rows={[
            [
              t('infoSpeed'),
              t('lyPerSecond', { value: Math.round(hud.speed * RIDE.lightYearsPerSpeed) }),
            ],
            [t('infoOrbs'), String(hud.orbs)],
            [t('infoSparks'), String(hud.sparks)],
            [t('infoTime'), clock(hud.time)],
            ...(best > 0
              ? [[t('infoBest'), `${number(best)} ${t('lightYearsShort')}`] as const]
              : []),
          ]}
        />
      )}
      <div class="corner">
        {gyro && (
          <button type="button" class="ghost small" onClick={onRecenter}>
            {t('recenter')}
          </button>
        )}
        <PauseButton onPause={onPause} />
      </div>
      {hint && (
        <div class="hint-card" role="dialog" aria-labelledby="ride-hint-title">
          <h2 id="ride-hint-title">{t('rideHintTitle')}</h2>
          <p>{t('rideHint', { keys: how })}</p>
          <button type="button" class="primary" onClick={onHintSeen}>
            {t('gotIt')}
          </button>
        </div>
      )}
      <TouchSticks input={input} />
    </div>
  )
}

interface WorldProps {
  readonly input: Input
  readonly world: WorldId
  readonly tier: number
  /** Light-years flown to get here. */
  readonly distance: number
  readonly onPause: () => void
  readonly hint: boolean
  readonly onHintSeen: () => void
}

/** Over a world: its name on arrival, a compass to the treasure and the buttons to act. */
export function WorldHud({ input, world, tier, distance, onPause, hint, onHintSeen }: WorldProps) {
  const hud = worldHud.value
  const [banner, setBanner] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setBanner(false), 4200)
    return () => clearTimeout(timer)
  }, [])
  const touch = touchScreen.value
  const pad = input.source.value === 'gamepad'
  const exploring = hud.phase === 'exploring'
  return (
    <div class="hud world-hud">
      <div class={`banner${banner ? '' : ' gone'}`}>
        <span class="small">{t('arrivedIn')}</span>
        <strong>{worldName(world)}</strong>
        <span class="tier" role="img" aria-label={`${t('holeTier')} ${tier}`}>
          {'✦'.repeat(tier)}
        </span>
      </div>
      {exploring && (
        <div class="compass" role="img" aria-label={t('findTreasure')}>
          <div class="needle" style={{ transform: `rotate(${hud.treasureBearing}rad)` }}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2 L18 16 L12 12.5 L6 16 Z" />
            </svg>
          </div>
          <span>{t('treasureAhead', { distance: hud.treasureDistance })}</span>
        </div>
      )}
      {exploring && !banner && hud.treasureDistance > 12 && (
        <p class="objective">{t('findTreasure')}</p>
      )}
      {hud.canOpen && (
        <button type="button" class="primary open-button" onClick={() => input.press('interact')}>
          {t('openTreasure')}
          {!touch && <kbd>{pad ? 'A' : t('openKey')}</kbd>}
        </button>
      )}
      {!banner && !touch && (
        <InfoPanel
          rows={[
            [worldName(world), '✦'.repeat(tier)],
            [t('infoFlown'), `${number(distance)} ${t('lightYearsShort')}`],
          ]}
        />
      )}
      <div class="corner">
        <PauseButton onPause={onPause} />
      </div>
      {touch && exploring && (
        <button
          type="button"
          class="round jump-button"
          aria-label={t('jump')}
          onPointerDown={() => input.press('confirm')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4 L19 12 H14.5 V20 H9.5 V12 H5 Z" />
          </svg>
        </button>
      )}
      {hint && exploring && (
        <div class="hint-card small-card" role="status">
          <p>
            {pad
              ? t('worldHintPad')
              : touch
                ? t('worldHintTouch')
                : t('worldHint', {
                    walk: t('worldHintKeys'),
                    look: t('worldHintLook'),
                    jump: t('worldHintSpace'),
                  })}
          </p>
          <button type="button" class="ghost small" onClick={onHintSeen}>
            {t('gotIt')}
          </button>
        </div>
      )}
      <TouchSticks input={input} />
    </div>
  )
}
