import { expect, type Page } from '@playwright/test'

/** Collects uncaught errors and console errors, so a broken start fails the test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

/** Opens the game with its debug hook and waits until the 3D view runs. */
export async function openGame(page: Page): Promise<void> {
  await page.goto('./?debug')
  await page.waitForFunction(() => 'wormhole' in window, null, { timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Fly!' })).toBeEnabled()
}

/** Puts a warp hole right in front of the ship, so the ride ends there. */
export async function warpInto(page: Page, color = 'green', tier = 3): Promise<void> {
  await page.evaluate(
    ([holeColor, holeTier]) => {
      const debug = (window as unknown as { wormhole: { director: { stage: { ride: Ride } } } })
        .wormhole
      const ride = debug.director.stage.ride
      const hole = {
        id: 99_999,
        x: ride.ship.x,
        y: ride.ship.y,
        z: 40,
        color: holeColor,
        tier: holeTier,
        radius: 3.3,
      }
      ride.holes.push(hole)
      // The hole takes the ship in whatever the controls say, as a slow ship's would.
      ride.captured = hole
      interface Ride {
        ship: { x: number; y: number }
        holes: object[]
        captured: object | undefined
      }
    },
    [color, tier] as const,
  )
}

/** Carries the girl next to the treasure, as a walk there would. */
export async function walkToTreasure(page: Page): Promise<void> {
  await page.evaluate(() => {
    interface Expedition {
      treasure: { x: number; z: number }
      walker: { x: number; y: number; z: number }
      land: { heightAt(x: number, z: number): number }
    }
    const debug = (
      window as unknown as { wormhole: { director: { stage: { expedition: Expedition } } } }
    ).wormhole
    const expedition = debug.director.stage.expedition
    const walker = expedition.walker
    walker.x = expedition.treasure.x + 1.5
    walker.z = expedition.treasure.z + 0.5
    walker.y = expedition.land.heightAt(walker.x, walker.z)
  })
}
