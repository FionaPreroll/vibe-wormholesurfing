import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { Settings } from '../game/settings'
import { type MessageKey, t } from '../i18n'
import {
  ACTIONS,
  type Action,
  type Bindings,
  bind,
  DEFAULT_BINDINGS,
  DEFAULT_STICKS,
  KEY_SLOTS,
  PAD_SLOTS,
  type StickSettings,
  unbind,
} from '../input/bindings'
import { PAD, type PadStyle, Pads } from '../input/gamepad'
import { holdMenuPad } from '../input/menuNav'
import {
  DEAD_ZONE_SHAPES,
  type DeadZoneShape,
  type StickTuning,
  tuneStick,
  type Vec2,
  ZERO,
} from '../input/stick'
import { keyName, padButtonName } from './controlNames'
import { Choice, Group, Slider, Toggle } from './fields'
import { Modal } from './Modal'

type Device = 'keys' | 'pad'

interface Listening {
  readonly device: Device
  readonly action: Action
  readonly slot: number
}

/** How long the dialog waits for a controller button before it gives up. */
const PAD_WAIT_MS = 8000

const SHAPE_NAMES: Readonly<Record<DeadZoneShape, MessageKey>> = {
  round: 'shapeRound',
  cross: 'shapeCross',
  square: 'shapeSquare',
}

/** The keypad's Enter is the same key as the main Enter, as the game reads it. */
const sameKey = (code: string) => (code === 'NumpadEnter' ? 'Enter' : code)

/**
 * Gives the menus the controller back once every button is up again, so the button that was just
 * bound does not press what has the focus. Returns a way to stop waiting.
 */
function releaseWhenUp(): () => void {
  const pads = new Pads()
  let frame = 0
  const poll = () => {
    if (pads.poll().held.size === 0) holdMenuPad(false)
    else frame = requestAnimationFrame(poll)
  }
  frame = requestAnimationFrame(poll)
  return () => cancelAnimationFrame(frame)
}

/** The controller's stick, read every frame while the dialog shows. */
function useStick(which: 'move' | 'look', swap: boolean): Vec2 {
  const [lean, setLean] = useState<Vec2>(ZERO)
  useEffect(() => {
    const pads = new Pads()
    let frame = 0
    let last = ZERO
    const poll = () => {
      const pad = pads.poll()
      const left = (which === 'move') !== swap
      const next = left ? pad.left : pad.right
      if (Math.abs(next.x - last.x) > 0.004 || Math.abs(next.y - last.y) > 0.004) {
        last = next
        setLean(next)
      }
      frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)
    return () => cancelAnimationFrame(frame)
  }, [which, swap])
  return lean
}

/** A picture of a stick: its travel, its dead zone, where it leans and what the game gets. */
function StickTest({
  which,
  tuning,
  swap,
}: {
  readonly which: 'move' | 'look'
  readonly tuning: StickTuning
  readonly swap: boolean
}) {
  const raw = useStick(which, swap)
  const out = tuneStick(raw, tuning, which === 'move' ? 1.3 : 1.6, true)
  const r = 44
  const dz = tuning.deadZone * r
  return (
    <svg class="stick-test" viewBox="-50 -50 100 100" aria-hidden="true">
      <circle class="travel" r={r} />
      {tuning.shape === 'round' && <circle class="dead" r={dz} />}
      {tuning.shape === 'square' && (
        <rect class="dead" x={-dz} y={-dz} width={dz * 2} height={dz * 2} />
      )}
      {tuning.shape === 'cross' && (
        <>
          <rect class="dead" x={-dz} y={-r} width={dz * 2} height={r * 2} />
          <rect class="dead" x={-r} y={-dz} width={r * 2} height={dz * 2} />
        </>
      )}
      <circle class="raw" cx={raw.x * r} cy={-raw.y * r} r={4} />
      <circle class="out" cx={out.x * r} cy={-out.y * r} r={5.5} />
    </svg>
  )
}

/** The fields of one stick: how strongly it answers, its dead zone and its shape. */
function StickFields({
  which,
  sticks,
  onChange,
}: {
  readonly which: 'move' | 'look'
  readonly sticks: StickSettings
  readonly onChange: (sticks: StickSettings) => void
}) {
  const tuning = sticks[which]
  const set = (patch: Partial<StickTuning>) =>
    onChange({ ...sticks, [which]: { ...tuning, ...patch } })
  return (
    <Group title={t(which === 'move' ? 'moveStick' : 'lookStick')}>
      <div class="stick-fields">
        <div class="stick-sliders">
          <Slider
            label={t('stickSensitivity', { value: tuning.sensitivity.toFixed(1) })}
            value={tuning.sensitivity}
            min={0.5}
            max={2}
            step={0.1}
            onInput={(sensitivity) => set({ sensitivity })}
          />
          <Slider
            label={t('deadZone', { percent: Math.round(tuning.deadZone * 100) })}
            value={tuning.deadZone}
            min={0}
            max={0.4}
            step={0.01}
            onInput={(deadZone) => set({ deadZone })}
          />
          <Choice
            label={t('deadZoneShape')}
            value={tuning.shape}
            options={DEAD_ZONE_SHAPES.map((shape) => ({
              value: shape,
              label: t(SHAPE_NAMES[shape]),
            }))}
            onChange={(shape) => set({ shape })}
          />
        </div>
        <StickTest which={which} tuning={tuning} swap={sticks.swap} />
      </div>
    </Group>
  )
}

interface Props {
  readonly settings: Settings
  readonly padStyle: PadStyle
  readonly onChange: (settings: Settings) => void
  readonly onClose: () => void
}

/** The controller's sticks, and which keys and buttons do what. */
export function ControlsDialog({ settings, padStyle, onChange, onClose }: Props) {
  const [listening, setListening] = useState<Listening>()
  const latest = useRef(settings)
  latest.current = settings
  const release = useRef<(() => void) | undefined>(undefined)
  const { bindings, sticks } = settings
  const setBindings = (next: Bindings) => onChange({ ...latest.current, bindings: next })
  const setSticks = (next: StickSettings) => onChange({ ...latest.current, sticks: next })

  // Waiting for a key: it goes into the slot, Esc cancels and Backspace empties the slot. The
  // listening starts as the slot says so, not a frame later, so a quick key is not lost.
  useLayoutEffect(() => {
    if (!listening) return
    const { device, action, slot } = listening
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.repeat) return
      const current = latest.current.bindings
      if (event.code === 'Escape') setListening(undefined)
      else if (device === 'keys' && event.code === 'Backspace') {
        setBindings(unbind(current, 'keys', action, slot))
        setListening(undefined)
      } else if (device === 'pad' && event.code === 'Backspace') {
        setBindings(unbind(current, 'pad', action, slot))
        setListening(undefined)
      } else if (device === 'keys') {
        setBindings(bind(current, 'keys', action, slot, sameKey(event.code)))
        setListening(undefined)
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [listening])

  // Waiting for a controller button: the menus leave the controller alone meanwhile.
  useLayoutEffect(() => {
    if (listening?.device !== 'pad') return
    const { action, slot } = listening
    release.current?.()
    holdMenuPad(true)
    const pads = new Pads()
    // Buttons already down, as the one that chose the slot, do not count.
    pads.poll()
    const started = performance.now()
    let frame = 0
    const poll = () => {
      const button = [...pads.poll().pressed][0]
      if (button !== undefined) {
        setBindings(bind(latest.current.bindings, 'pad', action, slot, button))
        setListening(undefined)
        return
      }
      if (performance.now() - started > PAD_WAIT_MS) {
        setListening(undefined)
        return
      }
      frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)
    return () => {
      cancelAnimationFrame(frame)
      release.current = releaseWhenUp()
    }
  }, [listening])

  // Closing the dialog gives the menus the controller back at once.
  useEffect(
    () => () => {
      release.current?.()
      holdMenuPad(false)
    },
    [],
  )

  const slotButton = (device: Device, action: Action, slot: number) => {
    const value = bindings[device][action][slot]
    const name =
      value === undefined
        ? undefined
        : device === 'keys'
          ? keyName(value as string)
          : padButtonName(value as number, padStyle)
    const waiting =
      listening?.device === device && listening.action === action && listening.slot === slot
    return (
      <td key={`${device}${slot}`}>
        <button
          type="button"
          class={`slot${waiting ? ' waiting' : ''}${name ? '' : ' empty'}`}
          aria-label={t('slotLabel', {
            action: t(`action_${action}` as MessageKey),
            device: t(device === 'keys' ? 'columnKeys' : 'columnPad'),
            slot: slot + 1,
            current: name ?? t('emptySlot'),
          })}
          onClick={() => setListening(waiting ? undefined : { device, action, slot })}
          onBlur={() => {
            if (waiting && device === 'keys') setListening(undefined)
          }}
        >
          {waiting ? t(device === 'keys' ? 'pressKey' : 'pressButton') : (name ?? '—')}
        </button>
      </td>
    )
  }

  return (
    <Modal id="controls" title={t('controlsTitle')} onClose={onClose} wide>
      <div class="settings controls">
        <h3>{t('sticksSection')}</h3>
        <p class="note">{t('stickTest')}</p>
        <StickFields which="move" sticks={sticks} onChange={setSticks} />
        <StickFields which="look" sticks={sticks} onChange={setSticks} />
        <Toggle
          label={t('swapSticks')}
          checked={sticks.swap}
          onChange={(swap) => setSticks({ ...sticks, swap })}
        />
        <h3>{t('bindingsSection')}</h3>
        <p class="note">
          {t('bindingsNote', {
            confirm: padButtonName(PAD.a, padStyle),
            back: padButtonName(PAD.b, padStyle),
          })}
        </p>
        <div class="bindings-scroll">
          <table class="bindings">
            <thead>
              <tr>
                <th scope="col">{t('columnAction')}</th>
                <th scope="col" colSpan={KEY_SLOTS}>
                  {t('columnKeys')}
                </th>
                <th scope="col" colSpan={PAD_SLOTS}>
                  {t('columnPad')}
                </th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((action) => (
                <tr key={action}>
                  <th scope="row">{t(`action_${action}` as MessageKey)}</th>
                  {Array.from({ length: KEY_SLOTS }, (_, slot) => slotButton('keys', action, slot))}
                  {Array.from({ length: PAD_SLOTS }, (_, slot) => slotButton('pad', action, slot))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => {
            setListening(undefined)
            onChange({ ...latest.current, bindings: DEFAULT_BINDINGS, sticks: DEFAULT_STICKS })
          }}
        >
          {t('resetControls')}
        </button>
      </div>
    </Modal>
  )
}
