import { effect } from '@preact/signals'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { version } from '../../package.json'
import type { MoodName } from '../audio/music'
import type { Ambience } from '../audio/synth'
import { Synth } from '../audio/synth'
import { freshSeed, seededRandom } from '../core/random'
import type { Reward } from '../core/rewards'
import type { RideOutcome } from '../core/ride'
import { holeRadius } from '../core/ride'
import { type WorldId, worldOf } from '../core/worlds'
import { type DebugReport, debugLog } from '../game/debugLog'
import { type GameEvent, onGameEvent } from '../game/events'
import { type Arrival, rideFeel } from '../game/hud'
import { QUALITIES, type Settings, settings } from '../game/settings'
import { t } from '../i18n'
import { buzz, haptics } from '../input/haptics'
import { Input } from '../input/input'
import { watchMenuKeys, watchMenuPad } from '../input/menuNav'
import { LogArchive, type StoredLog } from '../persistence/logs'
import { type Save, SaveBook } from '../persistence/save'
import { browserStore, type KeyValueStore, memoryStore } from '../persistence/store'
import type { Director } from '../view/director'
import { AboutScreen } from './AboutScreen'
import { offerUpdatesOnStart } from './appUpdates'
import { CollectionScreen, type Flight } from './CollectionScreen'
import { ControlsDialog } from './ControlsDialog'
import { learnKeyboardLayout } from './controlNames'
import { watchCursor } from './cursor'
import { HelpDialog, PauseMenu, SettingsDialog } from './dialogs'
import { enterFullScreen } from './FullScreen'
import {
  arrival,
  closeOverlay,
  found,
  graphicsFailed,
  loading,
  overlay,
  paused,
  screen,
} from './flow'
import { RideHud, WorldHud } from './Hud'
import { LoadingIndicator } from './LoadingIndicator'
import { loadWithProgress } from './loading'
import { exitApp, onBackButton } from './native'
import { touchScreen } from './pointer'
import { RewardCard } from './RewardCard'
import { shareCollection } from './share'
import { TitleScreen } from './TitleScreen'
import { UpdateNotice } from './UpdateNotice'

const AMBIENCE: Readonly<Record<WorldId, Ambience>> = {
  cliffs: 'wind',
  lagoon: 'water',
  canyon: 'wind',
  caverns: 'cave',
  crystalSea: 'water',
  starDunes: 'wind',
  floatingGardens: 'wind',
  auroraVoid: 'shimmer',
}

/** How strongly phones and controllers buzz for what happens. */
function buzzFor(event: GameEvent): void {
  switch (event.type) {
    case 'orb':
      buzz(0.15, 18)
      return
    case 'spark':
      buzz(0.9, 160)
      return
    case 'captured':
      buzz(0.5, 300)
      return
    case 'enter':
      buzz(0.7, 420)
      return
    case 'land':
      buzz(0.2, 25)
      return
    case 'reveal':
      buzz(0.4 + event.rarity * 0.12, 120 + event.rarity * 60)
      return
    default:
  }
}

/**
 * Frosted glass only at high and ultra quality: on phones, blurring the moving 3D view behind
 * every panel again each frame costs more than the 3D view itself.
 */
function setGlass(director: Director | undefined): void {
  const quality = director?.diagnostics().quality
  document.documentElement.dataset.glass =
    quality === 'high' || quality === 'ultra' ? 'frosted' : 'flat'
}

/** How many glitches and errors the debug log holds, in a line for the player. */
function summaryLine(): string {
  const summary = debugLog.summary()
  return t('debugSummary', { glitches: Number(summary.glitches), errors: Number(summary.errors) })
}

/** The graphics chip and how the 3D view runs on it, in lines for the about page. */
function graphicsLines(director: Director | undefined): string[] {
  const gpu = debugLog.environment.gpuRenderer
  const lines = typeof gpu === 'string' ? [t('graphicsChip', { gpu })] : []
  if (director) {
    const info = director.diagnostics()
    lines.push(
      t('graphicsNow', {
        quality: String(info.quality),
        ratio: String(info.pixelRatio),
        fps: director.stats.fps,
      }),
    )
  }
  return lines
}

interface Props {
  /** Where the save goes; IndexedDB unless a test passes another store. */
  readonly store?: KeyValueStore
}

export function App({ store }: Props) {
  const input = useMemo(() => new Input(), [])
  const synth = useMemo(() => new Synth(), [])
  const [book, setBook] = useState<SaveBook>()
  const [save, setSave] = useState<Save>()
  const [blocked, setBlocked] = useState(false)
  const [director, setDirector] = useState<Director>()
  const [card, setCard] = useState(false)
  /** Treasures found new since the collection was last opened, and one flying into it. */
  const [unseen, setUnseen] = useState<readonly string[]>([])
  const [flight, setFlight] = useState<Flight>()
  const [shareMessage, setShareMessage] = useState<string>()
  const [picture, setPicture] = useState<string>()
  const [fps, setFps] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const directorRef = useRef<Director | undefined>(undefined)
  const bookRef = useRef<SaveBook | undefined>(undefined)
  const archiveRef = useRef<LogArchive | undefined>(undefined)
  /** The debug logs the browser kept, read when a page that lists them opens. */
  const [savedLogs, setSavedLogs] = useState<readonly StoredLog[]>()

  const refresh = useCallback(() => {
    if (bookRef.current) setSave(bookRef.current.current)
  }, [])

  // Open the save, or keep everything in memory where the browser forbids saving.
  useEffect(() => {
    let cancelled = false
    const open = async () => {
      let opened: SaveBook
      try {
        opened = await SaveBook.open(store ?? browserStore())
      } catch {
        opened = await SaveBook.open(memoryStore())
        setBlocked(true)
      }
      if (cancelled) return
      bookRef.current = opened
      archiveRef.current = new LogArchive(opened.store, debugLog.openedAt.toISOString())
      // `?quality=high` and the like choose the graphics for this visit only, as for screenshots.
      const forced = new URLSearchParams(location.search).get('quality')
      const quality = QUALITIES.find((level) => level === forced)
      settings.value = quality ? { ...opened.current.settings, quality } : opened.current.settings
      setBook(opened)
      setSave(opened.current)
      // In the Android app: ask once whether to look for updates, then look if the player wants.
      void offerUpdatesOnStart((changes) => {
        const next = { ...settings.value, ...changes }
        settings.value = next
        void opened.setSettings(next).then(() => setSave(opened.current))
      }).catch((error: unknown) => debugLog.log('warn', `Update check failed: ${String(error)}`))
    }
    void open()
    return () => {
      cancelled = true
    }
  }, [store])

  // Settings reach every part that follows them, and the save.
  useEffect(
    () =>
      effect(() => {
        const current = settings.value
        input.settings.invertY = current.invertY
        input.settings.invertLookY = current.invertLookY
        input.settings.mouseSteer = current.mouseSteer
        input.settings.lookSpeed = current.lookSpeed
        input.settings.sticks = current.sticks
        input.settings.bindings = current.bindings
        input.gyro.range = current.gyroRange
        haptics.enabled = current.vibration
        synth.setVolumes(current.sound, current.music)
        const style = document.documentElement.style
        style.setProperty('--hud-scale', String(current.hudScale))
        style.setProperty('--menu-scale', String(current.menuScale))
        directorRef.current?.setQuality(current.quality)
        setGlass(directorRef.current)
      }),
    [input, synth],
  )

  useEffect(() => {
    if (!root.current) return
    return input.attach(root.current)
  }, [input])

  // Key names as the keyboard prints them, where the browser tells.
  useEffect(() => learnKeyboardLayout(), [])

  // The mouse pointer goes while the mouse is not in use.
  useEffect(
    () =>
      watchCursor(
        input.source,
        () =>
          (screen.value === 'ride' || screen.value === 'world') &&
          !paused.value &&
          overlay.value === undefined,
      ),
    [input],
  )

  // Sounds and buzzes for everything that happens.
  useEffect(
    () =>
      onGameEvent((event) => {
        synth.play(event)
        buzzFor(event)
      }),
    [synth],
  )

  // Browsers allow sound only after a tap or a key.
  useEffect(() => {
    const unlock = () => synth.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [synth])

  const setMood = useCallback(
    (mood: MoodName, ambience: Ambience) => {
      synth.setMood(mood)
      synth.setAmbience(ambience)
    },
    [synth],
  )

  const pause = useCallback(() => {
    if (screen.value !== 'ride' && screen.value !== 'world') return
    paused.value = true
    input.release()
    directorRef.current?.setPaused(true)
  }, [input])

  const resume = useCallback(() => {
    paused.value = false
    overlay.value = undefined
    input.release()
    directorRef.current?.setPaused(false)
  }, [input])

  // Hidden, as in the background on a phone, the game pauses and goes quiet.
  useEffect(() => {
    const changed = () => {
      if (document.visibilityState === 'hidden') {
        pause()
        synth.sleep()
      } else synth.wake()
    }
    document.addEventListener('visibilitychange', changed)
    return () => document.removeEventListener('visibilitychange', changed)
  }, [pause, synth])

  const showTitle = useCallback(() => {
    paused.value = false
    found.value = undefined
    setCard(false)
    screen.value = 'title'
    directorRef.current?.setPaused(false)
    directorRef.current?.showTitle()
    setMood('title', 'none')
  }, [setMood])

  const play = useCallback(() => {
    synth.unlock()
    if (touchScreen.value) void enterFullScreen()
    found.value = undefined
    setCard(false)
    setPicture(undefined)
    paused.value = false
    overlay.value = undefined
    screen.value = 'ride'
    directorRef.current?.setPaused(false)
    input.gyro.calibrate()
    directorRef.current?.startRide(freshSeed())
    setMood('ride', 'ride')
  }, [input, synth, setMood])

  /** A screen over the title's ride: the collection or the about page. */
  const openPanel = useCallback(
    (panel: 'collection' | 'about') => {
      if (screen.value === 'world' || screen.value === 'ride') directorRef.current?.showTitle()
      found.value = undefined
      paused.value = false
      overlay.value = undefined
      setCard(false)
      directorRef.current?.setPaused(false)
      screen.value = panel
      setMood('title', 'none')
    },
    [setMood],
  )
  const openCollection = useCallback(() => {
    setShareMessage(undefined)
    openPanel('collection')
  }, [openPanel])

  /** From the reward card, a new treasure flies from the card into its place. */
  const openCollectionFromCard = useCallback(() => {
    const result = found.value
    const from = document.querySelector('.reward-picture')?.getBoundingClientRect()
    if (result?.fresh && picture && from) setFlight({ id: result.reward.item.id, picture, from })
    openCollection()
  }, [openCollection, picture])

  const share = useCallback(() => {
    const save = bookRef.current?.current
    const director = directorRef.current
    if (!save || !director) return
    void shareCollection(save, (id, shiny) => director.thumbnail(id, shiny)).then((result) => {
      debugLog.log('info', `Collection shared: ${result}`)
      setShareMessage(
        result === 'shared'
          ? t('shareDone')
          : result === 'saved'
            ? t('shareSaved')
            : result === 'failed'
              ? t('shareFailed')
              : undefined,
      )
    })
  }, [])

  /** The debug log with what the game knows now. */
  const debugReport = useCallback((): DebugReport => {
    const save = bookRef.current?.current
    const report = debugLog.report(version, {
      settings: settings.value,
      save: save && {
        rides: save.stats.rides,
        bestDistance: save.stats.bestDistance,
        found: Object.keys(save.collection).length,
      },
      graphics: directorRef.current?.diagnostics(),
      screen: screen.value,
      address: location.href,
      visibility: document.visibilityState,
    })
    return report
  }, [])

  // The browser keeps this session's debug log as it goes on, and when the page is left, so a
  // glitch can be reported after a crash or a reload.
  useEffect(() => {
    const keep = () => void archiveRef.current?.keep(debugReport()).catch(() => undefined)
    const hidden = () => {
      if (document.visibilityState === 'hidden') keep()
    }
    const timer = setInterval(keep, 30_000)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', keep)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', keep)
    }
  }, [debugReport])

  const importSaveFile = useCallback(
    async (imported: Save) => {
      await bookRef.current?.replace(imported)
      settings.value = imported.settings
      debugLog.log('info', 'Save imported')
      refresh()
    },
    [refresh],
  )

  /** Where the hole the ship entered leads, settled as it enters and kept for its arrival. */
  const nextArrival = useRef<Arrival | undefined>(undefined)

  // The ship entered a hole: the world behind it is chosen now and made ready during the warp.
  const onEnter = useCallback((outcome: RideOutcome) => {
    const seed = freshSeed()
    const world = worldOf(seededRandom(seed), outcome.color, outcome.tier)
    const next = { ...outcome, world, seed }
    nextArrival.current = next
    directorRef.current?.prepareWorld(next, bookRef.current?.found ?? new Set())
  }, [])

  const onArrive = useCallback(
    (outcome: RideOutcome) => {
      const prepared = nextArrival.current
      nextArrival.current = undefined
      const seed = prepared?.seed ?? freshSeed()
      const next = prepared ?? {
        ...outcome,
        world: worldOf(seededRandom(seed), outcome.color, outcome.tier),
        seed,
      }
      void bookRef.current?.recordRide(outcome.distance, outcome.tier, next.world).then(refresh)
      // The warp's light holds until the world is ready to show.
      void directorRef.current
        ?.enterWorld(next, bookRef.current?.found ?? new Set())
        .then((shown) => {
          if (!shown) return
          arrival.value = next
          screen.value = 'world'
          setMood(next.world, AMBIENCE[next.world])
        })
    },
    [refresh, setMood],
  )

  const onReveal = useCallback(
    (reward: Reward) => {
      const where = arrival.value
      const saveBook = bookRef.current
      if (!where || !saveBook) return
      void saveBook
        .addFind(reward, Date.now(), {
          world: where.world,
          tier: where.tier,
          distance: where.distance,
        })
        .then(({ fresh, count }) => {
          found.value = {
            reward,
            world: where.world,
            tier: where.tier,
            distance: where.distance,
            fresh,
            count,
          }
          if (fresh) setUnseen((before) => [...before, reward.item.id])
          refresh()
        })
      setTimeout(() => {
        setPicture(directorRef.current?.thumbnail(reward.item.id, reward.shiny, 200))
        setCard(true)
      }, 1500)
    },
    [refresh],
  )

  // Start the 3D view once the save is open, so it starts in the chosen quality.
  useEffect(() => {
    if (!book || !canvas.current || directorRef.current) return
    let disposed = false
    loadWithProgress(() => import('../view/director'))
      .then(({ createDirector }) => {
        if (disposed || !canvas.current) return
        const created = createDirector(canvas.current, input, settings.value.quality, {
          onEnter,
          onArrive,
          onReveal,
          onPause: pause,
          onRecenter: () => input.gyro.calibrate(),
          reducedMotion: () => settings.value.reducedMotion,
          onFrame: () => {
            if (screen.value === 'ride') synth.setRide(rideFeel.speed, rideFeel.pull)
          },
        })
        directorRef.current = created
        created.showTitle()
        setGlass(created)
        setDirector(created)
        loading.value = false
        if (new URLSearchParams(location.search).has('debug'))
          (window as unknown as Record<string, unknown>).wormhole = {
            director: created,
            book,
            play,
            holeRadius,
            input,
            debugLog,
          }
      })
      .catch((error) => {
        console.error(error)
        graphicsFailed.value = true
        loading.value = false
      })
    return () => {
      disposed = true
    }
  }, [book, input, synth, onEnter, onArrive, onReveal, pause, play])

  useEffect(() => () => directorRef.current?.dispose(), [])

  // Gyro follows its setting.
  useEffect(() => {
    if (save?.settings.gyro && input.gyro.state.value === 'off') void input.gyro.enable()
  }, [save?.settings.gyro, input])

  // A controller and the arrow keys work the menus and dialogs.
  useEffect(() => {
    const inMenus = () =>
      screen.value === 'title' ||
      screen.value === 'collection' ||
      screen.value === 'about' ||
      paused.value ||
      overlay.value !== undefined ||
      card
    const stopPad = watchMenuPad(inMenus, () => {
      if (overlay.value) closeOverlay()
      else if (paused.value) resume()
      else if (screen.value === 'collection' || screen.value === 'about' || card) showTitle()
    })
    const stopKeys = watchMenuKeys(inMenus)
    return () => {
      stopPad()
      stopKeys()
    }
  }, [card, resume, showTitle])

  // Android's back button: closes what is open, pauses a ride or a walk, goes back to the title,
  // and on the title leaves the app, as the back button does on other apps' first screen.
  useEffect(
    () =>
      onBackButton(() => {
        const update = document.querySelector<HTMLElement>('.modal.update .buttons button')
        if (update) update.click()
        else if (overlay.value) closeOverlay()
        else if (paused.value) resume()
        else if (document.querySelector('[role="dialog"]'))
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        else if (screen.value === 'ride' || (screen.value === 'world' && !card)) pause()
        else if (screen.value === 'title') exitApp()
        else showTitle()
      }),
    [card, pause, resume, showTitle],
  )

  // Frames per second for the optional counter.
  useEffect(() => {
    if (!save?.settings.showFps) return
    const timer = setInterval(() => {
      const stats = directorRef.current?.stats
      setFps(
        stats
          ? t('fpsLine', {
              fps: stats.fps,
              ms: stats.frameMs,
              ratio: stats.pixelRatio,
              calls: stats.drawCalls,
            })
          : '',
      )
    }, 500)
    return () => clearInterval(timer)
  }, [save?.settings.showFps])

  const changeSettings = (next: Settings) => {
    settings.value = next
    void bookRef.current?.setSettings(next).then(refresh)
  }

  const toggleGyro = (on: boolean) => {
    changeSettings({ ...settings.value, gyro: on })
    if (on) void input.gyro.enable()
    else input.gyro.disable()
  }

  const hintSeen = (hint: 'rideHint' | 'worldHint') => {
    void bookRef.current?.markSeen(hint).then(refresh)
  }

  const current = screen.value
  const listsLogs = current === 'about' || overlay.value === 'settings'

  // Keep the log of now first, then list what the browser kept.
  useEffect(() => {
    const archive = archiveRef.current
    if (!listsLogs || !archive) return
    let cancelled = false
    void archive
      .keep(debugReport())
      .then(() => archive.list())
      .then((logs) => {
        if (!cancelled) setSavedLogs(logs)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [listsLogs, debugReport])
  const where = arrival.value
  const result = found.value
  return (
    <div class={`game screen-${current}`} ref={root}>
      <canvas class="stage-canvas" ref={canvas} />
      {loading.value && !graphicsFailed.value && current !== 'title' && <LoadingIndicator />}
      {graphicsFailed.value && (
        <p class="notice error" role="alert">
          {t('graphicsFailed')}
        </p>
      )}
      {save && current === 'title' && (
        <TitleScreen
          save={save}
          unseen={unseen.length}
          ready={director !== undefined}
          onPlay={play}
          onCollection={openCollection}
          onHelp={() => {
            overlay.value = 'help'
          }}
          onSettings={() => {
            overlay.value = 'settings'
          }}
          onAbout={() => openPanel('about')}
        />
      )}
      {current === 'ride' && save && (
        <RideHud
          input={input}
          best={save.stats.bestDistance}
          onPause={pause}
          onRecenter={() => input.gyro.calibrate()}
          hint={!save.seen.rideHint}
          onHintSeen={() => hintSeen('rideHint')}
        />
      )}
      {current === 'world' && where && save && !card && (
        <WorldHud
          key={where.seed}
          input={input}
          world={where.world}
          tier={where.tier}
          distance={where.distance}
          onPause={pause}
          hint={!save.seen.worldHint}
          onHintSeen={() => hintSeen('worldHint')}
        />
      )}
      {current === 'world' && card && result && (
        <RewardCard
          found={result}
          picture={picture}
          onFlyAgain={play}
          onCollection={openCollectionFromCard}
          onTitle={showTitle}
        />
      )}
      {current === 'collection' && save && (
        <CollectionScreen
          collection={save.collection}
          thumbnail={director ? (id, shiny) => director.thumbnail(id, shiny) : undefined}
          onBack={showTitle}
          arriving={unseen}
          flight={flight}
          reducedMotion={settings.value.reducedMotion}
          onArrived={() => {
            setUnseen([])
            setFlight(undefined)
          }}
          onShare={share}
          shareMessage={shareMessage}
        />
      )}
      {paused.value && !overlay.value && (
        <PauseMenu
          inWorld={current === 'world'}
          gyro={settings.value.gyro}
          onResume={resume}
          onRecenter={() => {
            input.gyro.calibrate()
            resume()
          }}
          onSettings={() => {
            overlay.value = 'settings'
          }}
          onHelp={() => {
            overlay.value = 'help'
          }}
          onQuit={showTitle}
        />
      )}
      {overlay.value === 'settings' && save && (
        <SettingsDialog
          settings={settings.value}
          save={save}
          onImport={importSaveFile}
          debugReport={debugReport}
          debugSummary={summaryLine()}
          savedLogs={savedLogs}
          session={archiveRef.current?.session}
          gyroState={input.gyro.state.value}
          onChange={changeSettings}
          onGyro={toggleGyro}
          onReset={() => void bookRef.current?.reset().then(refresh)}
          onControls={() => {
            overlay.value = 'controls'
          }}
          onClose={() => {
            overlay.value = undefined
          }}
        />
      )}
      {overlay.value === 'controls' && (
        <ControlsDialog
          settings={settings.value}
          padStyle={input.padStyle.value}
          onChange={changeSettings}
          onClose={closeOverlay}
        />
      )}
      {overlay.value === 'help' && (
        <HelpDialog
          padStyle={input.padStyle.value}
          onClose={() => {
            overlay.value = undefined
          }}
        />
      )}
      {current === 'about' && save && (
        <AboutScreen
          save={save}
          onImport={importSaveFile}
          debugReport={debugReport}
          debugSummary={summaryLine()}
          savedLogs={savedLogs}
          session={archiveRef.current?.session}
          graphics={graphicsLines(director)}
          onBack={showTitle}
        />
      )}
      <div class="notices">
        <UpdateNotice />
        {blocked && <p class="notice">{t('storageBlocked')}</p>}
      </div>
      {save?.settings.showFps && <div class="fps">{fps}</div>}
    </div>
  )
}
