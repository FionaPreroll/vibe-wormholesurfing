import { signal } from '@preact/signals-core'
import { PAD, Pads } from './gamepad'
import { Gyro } from './gyro'
import { FloatingStick, keysToVector, pointerSteer, type Vec2, ZERO } from './stick'

/** What the controls drive: the menus, the ship in the wormhole, or the girl on foot. */
export type InputMode = 'menu' | 'ride' | 'world'
export type Source = 'keyboard' | 'mouse' | 'gamepad' | 'touch' | 'gyro'

export interface InputSettings {
  /** Whether the mouse pointer steers the ship. */
  mouseSteer: boolean
  /** Up and down swapped while flying, as a pilot's stick has them. */
  invertY: boolean
  /** How fast dragging and the right stick turn the camera. */
  lookSpeed: number
}

/** The controls as one frame sees them. */
export interface ControlFrame {
  /** Steering or walking: right and up (or forward) positive, length up to 1. */
  readonly move: Vec2
  /** How far to turn the camera this frame, in radians: x around, y up and down. */
  readonly look: Vec2
  /** Zoom steps: positive moves the camera away. */
  readonly zoom: number
  /** Jump, or open the treasure when it is in reach. */
  readonly confirm: boolean
  readonly interact: boolean
  readonly pause: boolean
  readonly recenter: boolean
  readonly source: Source
}

/** A finger's stick or drag, for the screen to draw. */
export interface TouchView {
  readonly id: number
  readonly kind: 'move' | 'look'
  readonly originX: number
  readonly originY: number
  readonly x: number
  readonly y: number
  readonly radius: number
}

type Button = 'confirm' | 'interact' | 'pause' | 'recenter'

const KEYS = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  arrowUp: ['ArrowUp'],
  arrowDown: ['ArrowDown'],
  arrowLeft: ['ArrowLeft'],
  arrowRight: ['ArrowRight'],
  lookLeft: ['KeyJ'],
  lookRight: ['KeyL'],
  lookUp: ['KeyI'],
  lookDown: ['KeyK'],
} as const

const BUTTON_KEYS: Readonly<Record<string, Button>> = {
  Space: 'confirm',
  KeyE: 'interact',
  Enter: 'interact',
  NumpadEnter: 'interact',
  Escape: 'pause',
  KeyP: 'pause',
  KeyC: 'recenter',
}

const MOVE_CODES: ReadonlySet<string> = new Set([
  ...KEYS.up,
  ...KEYS.down,
  ...KEYS.left,
  ...KEYS.right,
  ...KEYS.arrowUp,
  ...KEYS.arrowDown,
  ...KEYS.arrowLeft,
  ...KEYS.arrowRight,
  ...KEYS.lookLeft,
  ...KEYS.lookRight,
  ...KEYS.lookUp,
  ...KEYS.lookDown,
])

/** How far, in pixels, the pointer must move before a resting mouse steers again. */
const MOUSE_WAKE = 40

/** Elements where keys belong to the element, such as a slider in the settings. */
function typingInto(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  )
}

/**
 * Every way to play, as one: keyboard, mouse, controller, touch and tilting. The source used
 * last decides where the ship or the girl goes, so picking up another way to play just works.
 */
export class Input {
  #mode: InputMode = 'menu'

  /** What the controls drive. A change starts the mouse afresh, as `release` does. */
  get mode(): InputMode {
    return this.#mode
  }

  set mode(next: InputMode) {
    if (next === this.#mode) return
    this.#mode = next
    this.#ignoreMouse()
  }
  readonly settings: InputSettings = { mouseSteer: true, invertY: false, lookSpeed: 1 }
  readonly gyro = new Gyro()
  readonly source = signal<Source>('keyboard')
  readonly touches = signal<readonly TouchView[]>([])
  readonly padConnected = signal(false)

  readonly #pads = new Pads()
  readonly #held = new Set<string>()
  #pressed = new Set<Button>()
  readonly #lastActive: Record<Source, number> = {
    keyboard: 0,
    mouse: Number.NEGATIVE_INFINITY,
    gamepad: Number.NEGATIVE_INFINITY,
    touch: Number.NEGATIVE_INFINITY,
    gyro: Number.NEGATIVE_INFINITY,
  }
  #mouse = { x: 0, y: 0, inside: false, drag: undefined as number | undefined, lastX: 0, lastY: 0 }
  /**
   * Where the pointer rested when the mouse last stopped counting, as when a ride starts with the
   * pointer still on the button that started it. Until it moves well away from here, the mouse
   * does not steer, so the ship does not dart toward wherever the pointer happens to be.
   */
  #mouseAnchor: { x: number; y: number } | undefined
  #lookX = 0
  #lookY = 0
  #zoom = 0
  readonly #fingers = new Map<
    number,
    { kind: 'move' | 'look'; stick?: FloatingStick; lastX: number; lastY: number }
  >()
  #element: HTMLElement | undefined

  /** Listens on the window for keys and on the game's element for pointers. */
  attach(element: HTMLElement): () => void {
    this.#element = element
    const listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
      [window, 'keydown', this.#onKeyDown as EventListener],
      [window, 'keyup', this.#onKeyUp as EventListener],
      [window, 'blur', this.#onBlur],
      [element, 'pointerdown', this.#onPointerDown as EventListener],
      [element, 'pointermove', this.#onPointerMove as EventListener],
      [element, 'pointerup', this.#onPointerUp as EventListener],
      [element, 'pointercancel', this.#onPointerUp as EventListener],
      [element, 'pointerleave', this.#onPointerLeave as EventListener],
      [element, 'wheel', this.#onWheel as EventListener, { passive: false }],
      [element, 'contextmenu', ((event: Event) => event.preventDefault()) as EventListener],
    ]
    for (const [target, type, listener, options] of listeners)
      target.addEventListener(type, listener, options)
    return () => {
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener)
      this.#element = undefined
    }
  }

  /** A press from an on-screen button. */
  press(button: Button): void {
    this.#pressed.add(button)
    this.#mark('touch')
  }

  /** Forgets everything held, as when a dialog opens over the game. */
  release(): void {
    this.#held.clear()
    this.#pressed.clear()
    this.#fingers.clear()
    this.#mouse.drag = undefined
    this.#lookX = 0
    this.#lookY = 0
    this.#zoom = 0
    this.touches.value = []
    this.#ignoreMouse()
  }

  /** The mouse steers again only once it moves on purpose. */
  #ignoreMouse(): void {
    this.#lastActive.mouse = Number.NEGATIVE_INFINITY
    this.#mouseAnchor = { x: this.#mouse.x, y: this.#mouse.y }
  }

  /** Reads every source once; call it once per frame. */
  frame(dt: number): ControlFrame {
    const now = performance.now()
    const pad = this.#pads.poll()
    this.padConnected.value = pad.connected
    if (pad.active) this.#mark('gamepad', now)

    const held = (codes: readonly string[]) => codes.some((code) => this.#held.has(code))
    // Flying, the arrows steer like WASD; on foot they turn the camera, as IJKL do.
    const arrowsLook = this.mode === 'world'
    const keys = keysToVector(
      held(KEYS.up) || (!arrowsLook && held(KEYS.arrowUp)),
      held(KEYS.down) || (!arrowsLook && held(KEYS.arrowDown)),
      held(KEYS.left) || (!arrowsLook && held(KEYS.arrowLeft)),
      held(KEYS.right) || (!arrowsLook && held(KEYS.arrowRight)),
    )
    if (keys.x !== 0 || keys.y !== 0) this.#mark('keyboard', now)

    const gyro = this.gyro
    if (this.mode === 'ride' && gyro.active && gyro.lastTilt > this.#lastActive.gyro)
      this.#lastActive.gyro = gyro.lastTilt

    let touchMove: Vec2 = ZERO
    for (const finger of this.#fingers.values())
      if (finger.kind === 'move' && finger.stick) touchMove = finger.stick.value

    const vectors: Record<Source, Vec2> = {
      keyboard: keys,
      gamepad: pad.move,
      touch: touchMove,
      gyro: this.mode === 'ride' ? gyro.read() : ZERO,
      mouse: this.#mouseSteer(),
    }
    const source = (Object.keys(this.#lastActive) as Source[]).reduce((best, candidate) =>
      this.#lastActive[candidate] > this.#lastActive[best] ? candidate : best,
    )
    if (this.source.value !== source) this.source.value = source
    let move = vectors[source]
    if (this.mode === 'ride' && this.settings.invertY) move = { x: move.x, y: -move.y }

    const turn = 2.4 * dt * this.settings.lookSpeed
    const lookRight = held(KEYS.lookRight) || (arrowsLook && held(KEYS.arrowRight))
    const lookLeft = held(KEYS.lookLeft) || (arrowsLook && held(KEYS.arrowLeft))
    const lookUp = held(KEYS.lookUp) || (arrowsLook && held(KEYS.arrowUp))
    const lookDown = held(KEYS.lookDown) || (arrowsLook && held(KEYS.arrowDown))
    const keyLookX = (lookRight ? 1 : 0) - (lookLeft ? 1 : 0)
    // Looking up lowers the camera, which tilts the view up.
    const keyLookY = (lookDown ? 1 : 0) - (lookUp ? 1 : 0)
    const look = {
      x: this.#lookX + (pad.look.x + keyLookX) * turn * 1.2,
      y: this.#lookY + (pad.look.y + keyLookY) * turn,
    }
    this.#lookX = 0
    this.#lookY = 0
    const zoom =
      this.#zoom + ((pad.held.has(PAD.rb) ? 1 : 0) - (pad.held.has(PAD.lb) ? 1 : 0)) * dt * 4
    this.#zoom = 0

    const pressed = this.#pressed
    this.#pressed = new Set()
    return {
      move,
      look,
      zoom,
      confirm: pressed.has('confirm') || pad.pressed.has(PAD.a),
      interact: pressed.has('interact') || pad.pressed.has(PAD.x),
      pause: pressed.has('pause') || pad.pressed.has(PAD.start),
      recenter: pressed.has('recenter') || pad.pressed.has(PAD.y),
      source,
    }
  }

  #mark(source: Source, now = performance.now()): void {
    this.#lastActive[source] = now
  }

  #mouseSteer(): Vec2 {
    const element = this.#element
    if (this.mode !== 'ride' || !this.settings.mouseSteer || !element) return ZERO
    const { width, height } = element.getBoundingClientRect()
    return pointerSteer(this.#mouse.x, this.#mouse.y, width, height)
  }

  readonly #onKeyDown = (event: KeyboardEvent) => {
    if (typingInto(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
    if (this.mode === 'menu') return
    const button = BUTTON_KEYS[event.code]
    if (button && !event.repeat) this.#pressed.add(button)
    this.#held.add(event.code)
    if (MOVE_CODES.has(event.code) || button) {
      this.#mark('keyboard')
      // Space and the arrows would scroll the page otherwise.
      event.preventDefault()
    }
  }

  readonly #onKeyUp = (event: KeyboardEvent) => {
    this.#held.delete(event.code)
  }

  readonly #onBlur = () => this.release()

  #local(event: PointerEvent): { x: number; y: number } {
    const rect = this.#element?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }

  readonly #onPointerDown = (event: PointerEvent) => {
    if (this.mode === 'menu') return
    // Buttons and dialogs over the game take their own taps.
    const target = event.target as Element | null
    if (target?.closest?.('button, a, input, select, label, [role="dialog"]')) return
    const { x, y } = this.#local(event)
    if (event.pointerType === 'mouse') {
      this.#mouse = { ...this.#mouse, x, y, inside: true, lastX: x, lastY: y }
      if (this.mode === 'world') {
        this.#mouse.drag = event.pointerId
        this.#capture(event.pointerId)
      }
      // A click on the game itself is meant: the mouse takes over at once.
      this.#mouseAnchor = undefined
      this.#mark('mouse')
      return
    }
    const width = this.#element?.getBoundingClientRect().width ?? 1
    const hasMove = [...this.#fingers.values()].some((finger) => finger.kind === 'move')
    const kind = this.mode === 'ride' || (x < width * 0.45 && !hasMove) ? 'move' : 'look'
    if (kind === 'move' && hasMove) return
    const radius = Math.max(44, Math.min(80, width * 0.07))
    this.#fingers.set(event.pointerId, {
      kind,
      stick: kind === 'move' ? new FloatingStick(x, y, radius) : undefined,
      lastX: x,
      lastY: y,
    })
    this.#capture(event.pointerId)
    this.#mark('touch')
    this.#publishTouches()
    event.preventDefault()
  }

  /** Keeps a pointer's moves coming even when it leaves the element. */
  #capture(pointerId: number): void {
    try {
      this.#element?.setPointerCapture?.(pointerId)
    } catch {
      // A pointer that is already gone cannot be captured; its moves just stop.
    }
  }

  readonly #onPointerMove = (event: PointerEvent) => {
    const { x, y } = this.#local(event)
    if (event.pointerType === 'mouse') {
      const mouse = this.#mouse
      if (mouse.drag === event.pointerId) {
        const speed = 0.0055 * this.settings.lookSpeed
        this.#lookX += (x - mouse.lastX) * speed
        this.#lookY -= (y - mouse.lastY) * speed
      }
      const moved = Math.hypot(x - mouse.x, y - mouse.y) > 1.5
      this.#mouse = { ...mouse, x, y, inside: true, lastX: x, lastY: y }
      // Pointing at a button over the game is not steering.
      const target = event.target as Element | null
      if (target?.closest?.('button, a, input, select, label, [role="dialog"]')) return
      const anchor = this.#mouseAnchor
      if (anchor) {
        if (Math.hypot(x - anchor.x, y - anchor.y) < MOUSE_WAKE) return
        this.#mouseAnchor = undefined
      }
      if (moved && (this.mode === 'world' ? mouse.drag !== undefined : this.settings.mouseSteer))
        this.#mark('mouse')
      return
    }
    const finger = this.#fingers.get(event.pointerId)
    if (!finger) return
    if (finger.stick) finger.stick.move(x, y)
    else {
      const speed = 0.008 * this.settings.lookSpeed
      this.#lookX += (x - finger.lastX) * speed
      this.#lookY -= (y - finger.lastY) * speed
    }
    finger.lastX = x
    finger.lastY = y
    this.#mark('touch')
    this.#publishTouches()
  }

  readonly #onPointerUp = (event: PointerEvent) => {
    if (this.#mouse.drag === event.pointerId) this.#mouse.drag = undefined
    if (this.#fingers.delete(event.pointerId)) this.#publishTouches()
  }

  readonly #onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && this.#mouse.drag === undefined) this.#mouse.inside = false
  }

  readonly #onWheel = (event: WheelEvent) => {
    if (this.mode !== 'world') return
    this.#zoom += Math.sign(event.deltaY) * 0.6
    event.preventDefault()
  }

  #publishTouches(): void {
    this.touches.value = [...this.#fingers.entries()].map(([id, finger]) => ({
      id,
      kind: finger.kind,
      originX: finger.stick?.originX ?? finger.lastX,
      originY: finger.stick?.originY ?? finger.lastY,
      x: finger.lastX,
      y: finger.lastY,
      radius: finger.stick?.radius ?? 0,
    }))
  }
}
