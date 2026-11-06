/**
 * How sharp the 3D view draws, as a share of the quality's pixel ratio: lower while frames come
 * late, higher once they are quick again. A step down is a trial: if the frame rate does not
 * improve by a tenth within a few seconds, the time goes elsewhere, as to the browser's own work
 * on a phone, and a blurrier picture would buy nothing. The resolution then goes back up, and
 * stays at least there on this screen.
 */

/** The lowest share of the pixel ratio. */
export const MIN_SCALE = 0.55
const STEP_DOWN = 0.12
const STEP_UP = 0.08
/** Seconds after lowering before the resolution may go up again, so it does not swing. */
export const RAISE_COOLDOWN = 20
/** Seconds after lowering before judging whether it helped. */
export const TRIAL = 3
/** How much faster frames must come after lowering, for it to count as help. */
const HELPED = 1.1

export interface ResolutionChange {
  readonly kind: 'lowered' | 'raised' | 'kept'
  readonly from: number
  readonly to: number
  readonly fps: number
  /** For `kept`: the frame rate before the step down that did not help. */
  readonly fpsBefore?: number
}

export class Resolution {
  scale = 1
  /** The lowest the scale may go on this screen. */
  floor = MIN_SCALE
  #slow = 0
  #fast = 0
  #raiseBlockedUntil = 0
  #trial: { from: number; fps: number; at: number } | undefined

  /** A new quality: start sharp again. */
  reset(): void {
    this.scale = 1
    this.newScreen()
  }

  /** A new screen may be slow for other reasons: lowering may help there. */
  newScreen(): void {
    this.floor = MIN_SCALE
    this.#trial = undefined
    this.#slow = 0
    this.#fast = 0
  }

  /**
   * Takes one frame: its time `dt` and the clock `now` in seconds, and the frames per second of
   * the last full second. Returns what changed, if anything.
   */
  frame(dt: number, now: number, fps: number): ResolutionChange | undefined {
    if (dt > 1 / 45) {
      this.#slow += dt
      this.#fast = 0
    } else if (dt < 1 / 57) {
      this.#fast += dt
      this.#slow = Math.max(0, this.#slow - dt * 0.5)
    }
    const trial = this.#trial
    if (trial && now >= trial.at) {
      this.#trial = undefined
      if (fps < trial.fps * HELPED) {
        const from = this.scale
        this.scale = trial.from
        this.floor = trial.from
        this.#slow = 0
        return { kind: 'kept', from, to: this.scale, fps, fpsBefore: trial.fps }
      }
    }
    if (!this.#trial && this.#slow > 1 && this.scale > this.floor) {
      const from = this.scale
      this.scale = Math.max(this.floor, Number((this.scale - STEP_DOWN).toFixed(2)))
      this.#slow = 0
      this.#raiseBlockedUntil = now + RAISE_COOLDOWN
      this.#trial = { from, fps, at: now + TRIAL }
      return { kind: 'lowered', from, to: this.scale, fps }
    }
    if (this.#fast > 6 && this.scale < 1 && now > this.#raiseBlockedUntil) {
      const from = this.scale
      this.scale = Math.min(1, Number((this.scale + STEP_UP).toFixed(2)))
      this.#fast = 0
      return { kind: 'raised', from, to: this.scale, fps }
    }
    return undefined
  }
}
