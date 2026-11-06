/**
 * Saves one after another, so the last change always wins. A failed save reaches its caller but
 * does not hold up the next one.
 */
export class SaveQueue {
  #saving: Promise<void> = Promise.resolve()

  /** Runs the save after the ones before it. */
  run(save: () => Promise<void>): Promise<void> {
    const next = this.#saving.catch(() => undefined).then(save)
    this.#saving = next
    return next
  }

  /** Waits until every save so far is done. */
  saved(): Promise<void> {
    return this.#saving
  }
}
