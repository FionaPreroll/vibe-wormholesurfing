import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { RIDE } from '../core/ride'
import type { WorldId } from '../core/worlds'
import { rideHud, worldHud } from '../game/hud'
import { settings } from '../game/settings'
import { t, worldName } from '../i18n'
import type { Input } from '../input/input'
import { buttonsFor, directionKeys, keysFor } from './controlNames'
import { Lcd } from './lcd'
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

/** A labelled readout of the cockpit panel. */
function Readout({
  label,
  children,
}: {
  readonly label: string
  readonly children: ComponentChildren
}) {
  return (
    <div class="readout">
      <span class="readout-label">{label}</span>
      <span class="readout-value">{children}</span>
    </div>
  )
}

const GAUGE = { cx: 60, cy: 58, r: 46, from: 150, sweep: 240 }

function arcPoint(angle: number, radius = GAUGE.r): [number, number] {
  const rad = (angle * Math.PI) / 180
  return [GAUGE.cx + Math.cos(rad) * radius, GAUGE.cy + Math.sin(rad) * radius]
}

function arcPath(radius: number): string {
  const [x1, y1] = arcPoint(GAUGE.from, radius)
  const [x2, y2] = arcPoint(GAUGE.from + GAUGE.sweep, radius)
  return `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`
}

/**
 * The ship's speed as a round gauge: a rainbow arc that fills with speed, a mark at the speed
 * that is safe from the pull of holes, an inner arc for that pull, and the speed in light-years
 * per second on an LCD in its middle.
 */
function SpeedGauge({ speed, pull }: { readonly speed: number; readonly pull: number }) {
  const share = Math.min(1, speed / RIDE.maxSpeed)
  const safe = RIDE.safeSpeed / RIDE.maxSpeed
  const [sx1, sy1] = arcPoint(GAUGE.from + safe * GAUGE.sweep, GAUGE.r - 7)
  const [sx2, sy2] = arcPoint(GAUGE.from + safe * GAUGE.sweep, GAUGE.r + 6)
  const ticks = Array.from({ length: 13 }, (_, index) => {
    const angle = GAUGE.from + (index / 12) * GAUGE.sweep
    const [x1, y1] = arcPoint(angle, GAUGE.r + 5)
    const [x2, y2] = arcPoint(angle, GAUGE.r + (index % 3 === 0 ? 9 : 7))
    return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} class="gauge-tick" />
  })
  return (
    <div class="speed-gauge">
      <svg viewBox="0 0 120 104" aria-hidden="true">
        <defs>
          <linearGradient id="speed-gradient" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stop-color="#ff5c8a" />
            <stop offset="0.45" stop-color="#ffd166" />
            <stop offset="1" stop-color="#6ff7ff" />
          </linearGradient>
          <linearGradient id="pull-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#b26bff" />
            <stop offset="1" stop-color="#ff3d6e" />
          </linearGradient>
        </defs>
        {ticks}
        <path d={arcPath(GAUGE.r)} class="gauge-track" />
        <path
          d={arcPath(GAUGE.r)}
          class="gauge-fill"
          pathLength={100}
          stroke-dasharray={`${share * 100} 100`}
        />
        <path d={arcPath(GAUGE.r - 11)} class="gauge-track thin" />
        {pull > 0.01 && (
          <path
            d={arcPath(GAUGE.r - 11)}
            class="gauge-pull"
            pathLength={100}
            stroke-dasharray={`${Math.min(1, pull) * 100} 100`}
          />
        )}
        <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} class="gauge-safe" />
      </svg>
      <div class="gauge-center">
        <Lcd
          value={String(Math.round(speed * RIDE.lightYearsPerSpeed))}
          digits={3}
          size={24}
          label={t('infoSpeed')}
        />
        <span class="gauge-unit">{t('lyPerSecond', { value: '' }).trim()}</span>
      </div>
      {pull > 0.35 && <span class="gauge-warning">{t('infoGravity')}</span>}
    </div>
  )
}

/** How near the treasure is, as a bar that fills as the girl comes closer. */
function NearBar({ meters }: { readonly meters: number }) {
  const share = Math.max(0, Math.min(1, 1 - meters / 60))
  return (
    <span class="near-bar" aria-hidden="true">
      <span class="near-fill" style={{ width: `${share * 100}%` }} />
    </span>
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
  const { bindings, sticks } = settings.value
  const how = gyro
    ? t('rideHintGyro')
    : source === 'gamepad'
      ? t(sticks.swap ? 'rightStick' : 'leftStick')
      : touchScreen.value
        ? t('rideHintTouch')
        : t('rideHintKeys', { keys: directionKeys(bindings, 'move') })
  return (
    <div class={`hud ride-hud${hud.warping ? ' warping' : ''}`}>
      <div class="distance" aria-live="off">
        <Lcd
          value={String(hud.distance)}
          digits={5}
          size={46}
          color="var(--lcd-white)"
          label={t('lightYears')}
        />
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
        <div class="cockpit">
          <SpeedGauge speed={hud.speed} pull={pull} />
          <div class="readouts">
            <Readout label={t('infoOrbs')}>
              <Lcd
                value={String(hud.orbs)}
                digits={3}
                color="var(--lcd-gold)"
                label={t('infoOrbs')}
              />
            </Readout>
            <Readout label={t('infoSparks')}>
              <Lcd
                value={String(hud.sparks)}
                digits={3}
                color="var(--lcd-blue)"
                label={t('infoSparks')}
              />
            </Readout>
            <Readout label={t('infoTime')}>
              <Lcd value={clock(hud.time)} color="var(--lcd-pink)" label={t('infoTime')} />
            </Readout>
            {best > 0 && (
              <Readout label={t('infoBest')}>
                <Lcd value={String(Math.round(best))} digits={5} label={t('infoBest')} />
              </Readout>
            )}
          </div>
        </div>
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
  const { bindings, sticks } = settings.value
  const style = input.padStyle.value
  // Opening takes the interact button, or the jump button near the treasure.
  const openWith = pad
    ? buttonsFor(bindings, 'interact', style) || buttonsFor(bindings, 'confirm', style)
    : keysFor(bindings, 'interact') || keysFor(bindings, 'confirm')
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
          {!touch && openWith && <kbd>{openWith}</kbd>}
        </button>
      )}
      {!banner && (
        <div class="cockpit world-cockpit">
          <div class="cockpit-title">
            <span>{worldName(world)}</span>
            <span class="tier">{'✦'.repeat(tier)}</span>
          </div>
          <div class="readouts">
            <Readout label={t('infoFlown')}>
              <Lcd value={String(Math.round(distance))} digits={5} label={t('infoFlown')} />
            </Readout>
            {exploring && (
              <Readout label={t('infoTreasure')}>
                <NearBar meters={hud.treasureDistance} />
                <Lcd
                  value={String(hud.treasureDistance)}
                  digits={3}
                  color="var(--lcd-gold)"
                  label={t('infoTreasure')}
                />
              </Readout>
            )}
          </div>
        </div>
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
              ? t('worldHintPad', {
                  walk: t(sticks.swap ? 'rightStick' : 'leftStick'),
                  look: t(sticks.swap ? 'leftStick' : 'rightStick'),
                  jump: buttonsFor(bindings, 'confirm', style),
                  open: buttonsFor(bindings, 'interact', style),
                })
              : touch
                ? t('worldHintTouch')
                : t('worldHint', {
                    walk: directionKeys(bindings, 'move'),
                    look: t('worldHintLook', { keys: directionKeys(bindings, 'look') }),
                    jump: keysFor(bindings, 'confirm'),
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
