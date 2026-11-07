import { type Page, test } from '@playwright/test'
import { holeRadius, pitchFor, RIDE } from '../../src/core/ride'
import { openGame } from '../e2e/game'

/** Writes a picture of `docs/hitboxes.md` into docs/screenshots/hitboxes/. */
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `docs/screenshots/hitboxes/${name}.png` })

/** Where the camera looks from: the ride's own, from the right side, or from far behind. */
type View = 'ride' | 'side' | 'far'

interface Thing {
  readonly x: number
  readonly y: number
  /** Distance ahead of the ship's middle. */
  readonly z: number
}

interface HoleThing extends Thing {
  readonly color: 'red' | 'blue' | 'green' | 'yellow' | 'white'
  readonly tier: 1 | 2 | 3 | 4
}

/** A still moment of a ride, set up by hand. */
interface Scene {
  readonly view: View
  readonly ship?: {
    readonly x: number
    readonly y: number
    readonly vx?: number
    readonly vy?: number
  }
  readonly orbs?: readonly Thing[]
  readonly sparks?: readonly Thing[]
  readonly holes?: readonly HoleThing[]
}

/** Lets the game draw this many frames, so the camera and the view settle on a scene. */
async function frames(page: Page, count: number): Promise<void> {
  await page.evaluate(
    (total) =>
      new Promise<void>((resolve) => {
        let left = total
        const tick = () => {
          left--
          if (left <= 0) resolve()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    count,
  )
}

/**
 * Stops the ride's simulation, so nothing moves on and nothing is taken, and puts the ship and
 * what comes toward it where the scene says. The view goes on drawing them, hitboxes and all.
 */
async function stage(page: Page, scene: Scene): Promise<void> {
  const ship = scene.ship ?? { x: 0, y: 0 }
  const vx = ship.vx ?? 0
  const vy = ship.vy ?? 0
  await page.evaluate(
    ({ scene, ship, attitude, radii }) => {
      interface Ride {
        advance: (seconds: number, steer: unknown) => unknown[]
        ship: Record<string, number>
        orbs: object[]
        sparks: object[]
        holes: object[]
      }
      interface Stage {
        ride: Ride
        camera: {
          position: { set(x: number, y: number, z: number): void }
          up: { set(x: number, y: number, z: number): void }
          lookAt(x: number, y: number, z: number): void
        }
        update: (dt: number, controls: unknown) => void
      }
      const game = window as unknown as {
        wormhole: { director: { stage: Stage } }
        hitboxView?: { view: string }
      }
      const stage = game.wormhole.director.stage
      const ride = stage.ride
      ride.advance = () => []
      if (!game.hitboxView) {
        // The ride's camera follows the ship; the others are set after it, every frame.
        const update = stage.update.bind(stage)
        stage.update = (dt, controls) => {
          update(dt, controls)
          const view = game.hitboxView?.view
          const at = stage.ride.ship
          const x = at.x ?? 0
          const y = at.y ?? 0
          if (view === 'side') stage.camera.position.set(x + 3.6, y + 1.1, -0.5)
          else if (view === 'far') stage.camera.position.set(x * 0.3, y * 0.3 + 2, 15)
          else return
          stage.camera.up.set(0, 1, 0)
          if (view === 'side') stage.camera.lookAt(x, y + 0.2, -0.5)
          else stage.camera.lookAt(x * 0.3, y * 0.3, -2)
        }
      }
      game.hitboxView = { view: scene.view }
      Object.assign(ride.ship, { x: ship.x, y: ship.y, ...attitude })
      ride.orbs.length = 0
      ride.sparks.length = 0
      ride.holes.length = 0
      let id = 1_000_000
      for (const orb of scene.orbs ?? []) ride.orbs.push({ id: id++, ...orb, taken: false })
      for (const spark of scene.sparks ?? [])
        ride.sparks.push({
          id: id++,
          ...spark,
          cx: spark.x,
          cy: spark.y,
          orbit: 0,
          phase: 0,
          spin: 0,
          hit: false,
        })
      for (const hole of scene.holes ?? [])
        ride.holes.push({ id: id++, ...hole, radius: radii[hole.tier] })
    },
    {
      scene,
      ship,
      attitude: { vx, vy, yaw: vx * RIDE.noseTurn, pitch: pitchFor(vy) },
      radii: { 1: holeRadius(1), 2: holeRadius(2), 3: holeRadius(3), 4: holeRadius(4) },
    },
  )
  await frames(page, 45)
}

test.use({ viewport: { width: 1280, height: 720 }, locale: 'en-US' })
test.describe.configure({ timeout: 900_000 })

test('the hitboxes of a ride', async ({ page }) => {
  await openGame(page, 'high')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel(/Show hitboxes in rides/).check()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Fly!' }).click()
  await page.getByRole('button', { name: 'Got it' }).click()
  await page.waitForFunction(
    () =>
      (window as unknown as { wormhole: { director: { stage?: { ride?: { demo: boolean } } } } })
        .wormhole.director.stage?.ride?.demo === false,
  )
  const touch = RIDE.noseReach + 0.2

  // The field the ship's middle stays in, from far behind.
  await stage(page, { view: 'far', ship: { x: 2.6, y: -1.4 } })
  await shot(page, 'field')
  // The ship as the player sees it, and from the side.
  await stage(page, { view: 'ride' })
  await shot(page, 'ship')
  await stage(page, { view: 'side' })
  await shot(page, 'ship-side')
  // Climbing: the nose, and the hitbox for orbs and sparks with it, tips up.
  await stage(page, { view: 'side', ship: { x: 0, y: 0, vy: RIDE.maxLateral } })
  await shot(page, 'climb-side')
  // An orb as the circles first overlap, and a spark.
  await stage(page, { view: 'ride', orbs: [{ x: 1.3, y: 0.35, z: touch }] })
  await shot(page, 'orb')
  await stage(page, { view: 'ride', sparks: [{ x: -1.25, y: 0.3, z: touch }] })
  await shot(page, 'spark')
  // A hole a moment before it reaches the ship's middle, with the middle inside its circle.
  await stage(page, { view: 'ride', holes: [{ x: 0.9, y: 0.4, z: 9, color: 'blue', tier: 2 }] })
  await shot(page, 'hole')
  // A straight line of orbs and a hole ahead, beside the ship: the view draws them along the
  // bent tunnel, and their circles with them.
  await stage(page, {
    view: 'ride',
    orbs: [20, 50, 80, 110, 140, 170, 200, 230].map((z) => ({ x: -4.5, y: -1.5, z })),
    holes: [{ x: -4.5, y: -1.5, z: 300, color: 'green', tier: 1 }],
  })
  await shot(page, 'bend')
})
