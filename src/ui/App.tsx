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
import { debugLog } from '../game/debugLog'
import { type GameEvent, onGameEvent } from '../game/events'
import { rideHud } from '../game/hud'
import { QUALITIES, type Settings, settings } from '../game/settings'
import { t } from '../i18n'
import { buzz, haptics } from '../input/haptics'
import { Input } from '../input/input'
import { watchMenuPad } from '../input/menuNav'
import { type Save, SaveBook } from '../persistence/save'
import { browserStore, type KeyValueStore, memoryStore } from '../persistence/store'
import type { Director } from '../view/director'
import { AboutScreen } from './AboutScreen'
import { CollectionScreen } from './CollectionScreen'
import { HelpDialog, PauseMenu, SettingsDialog } from './dialogs'
import { enterFullScreen } from './FullScreen'
import { arrival, found, graphicsFailed, loading, overlay, paused, screen } from './flow'
import { RideHud, WorldHud } from './Hud'
import { LoadingIndicator } from './LoadingIndicator'
import { loadWithProgress } from './loading'
import { touchScreen } from './pointer'
import { RewardCard } from './RewardCard'
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
  const [picture, setPicture] = useState<string>()
  const [fps, setFps] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const directorRef = useRef<Director | undefined>(undefined)
  const bookRef = useRef<SaveBook | undefined>(undefined)

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
      // `?quality=high` and the like choose the graphics for this visit only, as for screenshots.
      const forced = new URLSearchParams(location.search).get('quality')
      const quality = QUALITIES.find((level) => level === forced)
      settings.value = quality ? { ...opened.current.settings, quality } : opened.current.settings
      setBook(opened)
      setSave(opened.current)
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
        input.settings.mouseSteer = current.mouseSteer
        input.settings.lookSpeed = current.lookSpeed
        input.gyro.range = current.gyroRange
        haptics.enabled = current.vibration
        synth.setVolumes(current.sound, current.music)
        directorRef.current?.setQuality(current.quality)
      }),
    [input, synth],
  )

  useEffect(() => {
    if (!root.current) return
    return input.attach(root.current)
  }, [input])

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
  const openCollection = useCallback(() => openPanel('collection'), [openPanel])

  /** The debug log with what the game knows now, as a file's text. */
  const debugReport = useCallback(() => {
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
    return `${JSON.stringify(report, null, 2)}\n`
  }, [])

  const importSaveFile = useCallback(
    async (imported: Save) => {
      await bookRef.current?.replace(imported)
      settings.value = imported.settings
      debugLog.log('info', 'Save imported')
      refresh()
    },
    [refresh],
  )

  const onArrive = useCallback(
    (outcome: RideOutcome) => {
      const seed = freshSeed()
      const world = worldOf(seededRandom(seed), outcome.color, outcome.tier)
      const next = { ...outcome, world, seed }
      arrival.value = next
      void bookRef.current?.recordRide(outcome.distance, outcome.tier, world).then(refresh)
      screen.value = 'world'
      directorRef.current?.enterWorld(next, bookRef.current?.found ?? new Set())
      setMood(world, AMBIENCE[world])
    },
    [refresh, setMood],
  )

  const onReveal = useCallback(
    (reward: Reward) => {
      const where = arrival.value
      const saveBook = bookRef.current
      if (!where || !saveBook) return
      void saveBook.addFind(reward).then(({ fresh, count }) => {
        found.value = {
          reward,
          world: where.world,
          tier: where.tier,
          distance: where.distance,
          fresh,
          count,
        }
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
          onArrive,
          onReveal,
          onPause: pause,
          onRecenter: () => input.gyro.calibrate(),
          reducedMotion: () => settings.value.reducedMotion,
          onFrame: () => {
            if (screen.value === 'ride') synth.setRide(rideHud.value.speed, rideHud.value.pull)
          },
        })
        directorRef.current = created
        created.showTitle()
        setDirector(created)
        loading.value = false
        if (new URLSearchParams(location.search).has('debug'))
          (window as unknown as Record<string, unknown>).wormhole = {
            director: created,
            book,
            play,
            holeRadius,
            input,
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
  }, [book, input, synth, onArrive, onReveal, pause, play])

  useEffect(() => () => directorRef.current?.dispose(), [])

  // Gyro follows its setting.
  useEffect(() => {
    if (save?.settings.gyro && input.gyro.state.value === 'off') void input.gyro.enable()
  }, [save?.settings.gyro, input])

  // A controller works the menus and dialogs.
  useEffect(
    () =>
      watchMenuPad(
        () =>
          screen.value === 'title' ||
          screen.value === 'collection' ||
          screen.value === 'about' ||
          paused.value ||
          overlay.value !== undefined ||
          card,
        () => {
          if (overlay.value) overlay.value = undefined
          else if (paused.value) resume()
          else if (screen.value === 'collection' || screen.value === 'about') showTitle()
        },
      ),
    [card, resume, showTitle],
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
          onCollection={openCollection}
          onTitle={showTitle}
        />
      )}
      {current === 'collection' && save && (
        <CollectionScreen
          collection={save.collection}
          thumbnail={director ? (id, shiny) => director.thumbnail(id, shiny) : undefined}
          onBack={showTitle}
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
          gyroState={input.gyro.state.value}
          onChange={changeSettings}
          onGyro={toggleGyro}
          onReset={() => void bookRef.current?.reset().then(refresh)}
          onClose={() => {
            overlay.value = undefined
          }}
        />
      )}
      {overlay.value === 'help' && (
        <HelpDialog
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
