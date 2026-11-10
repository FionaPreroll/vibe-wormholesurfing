/*
 * The desktop app's main process: a window that shows the web build in dist/, with Electron's own
 * Chromium, so the game draws, sounds and reads controllers as in Chrome on Windows, macOS and
 * Linux alike. `pnpm desktop` runs it; electron-builder.yml packs it.
 */
// CommonJS, as Electron's main process runs most simply, and as Playwright can start it for the
// smoke test: it does not get an app whose main module is ES and waits at the top level.
import path = require('node:path')
import url = require('node:url')
import electron = require('electron')

const { app, BrowserWindow, ipcMain, Menu, net, protocol, session, shell } = electron
const { join, normalize, sep } = path

/**
 * The game is served from app://wormhole/ rather than from file://: a fixed origin of its own, as
 * the website has, for the save in IndexedDB and the language in localStorage, and one that
 * fetch() reaches, as the loading bar reads the files it fetches.
 */
const SCHEME = 'app'
const HOST = 'wormhole'
const ORIGIN = `${SCHEME}://${HOST}`

/** The web build, beside desktop/ in the project and in the packed app alike. */
const root = join(__dirname, '..', '..', 'dist')

/** Where pages may send the player: to the browser, never inside the game's window. */
const OUTSIDE = /^(https?|mailto):/

/**
 * The newest desktop build's number and commit, in the release CI replaces with every build of
 * main. Tests point it at a server of their own.
 */
const LATEST_BUILD =
  process.env.WORMHOLE_UPDATES_URL ??
  'https://github.com/FionaPreroll/vibe-wormholesurfing/releases/download/desktop-latest/version.json'

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
  },
])

// The save and the settings live in a folder named after the game, the same for a build run from
// the project and a packed one. Tests point it at a folder of their own.
app.setPath(
  'userData',
  process.env.WORMHOLE_USER_DATA ?? join(app.getPath('appData'), 'Wormhole Surfing'),
)

/** Serves a file of dist/ for an address of the game's origin, and nothing outside dist/. */
async function serve(request: Request): Promise<Response> {
  const address = new URL(request.url)
  if (address.host !== HOST) return new Response(null, { status: 404 })
  const file = normalize(join(root, decodeURIComponent(address.pathname)))
  if (!file.startsWith(root + sep)) return new Response(null, { status: 403 })
  return net.fetch(url.pathToFileURL(file).toString())
}

/**
 * Fetches the newest build's version.json for the game's page, which cannot itself: GitHub's
 * downloads do not allow other origins. Only for the game's own origin, and only this file.
 */
async function latestBuild(event: electron.IpcMainInvokeEvent): Promise<unknown> {
  if (!event.senderFrame?.url.startsWith(`${ORIGIN}/`)) throw new Error('Not the game')
  const response = await net.fetch(LATEST_BUILD, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

/**
 * Closes the game's window for the title screen's Exit game button, as its own close button does:
 * the page saves what it keeps as it goes, and the app quits with its last window.
 */
function quit(event: electron.IpcMainEvent): void {
  if (!event.senderFrame?.url.startsWith(`${ORIGIN}/`)) return
  BrowserWindow.fromWebContents(event.sender)?.close()
}

function openWindow(): electron.BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 360,
    title: 'Wormhole Surfing',
    // The title screen's night sky, so the window is not white before the game draws.
    backgroundColor: '#0a0618',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })
  window.once('ready-to-show', () => window.show())
  const contents = window.webContents
  // Links to the issue tracker, the web version or an email open where they belong.
  contents.setWindowOpenHandler(({ url }) => {
    if (OUTSIDE.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${ORIGIN}/`)) return
    event.preventDefault()
    if (OUTSIDE.test(url)) void shell.openExternal(url)
  })
  // F11 fills the screen, as in a browser; the game's own button does too.
  contents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault()
      window.setFullScreen(!window.isFullScreen())
    }
  })
  void window.loadURL(`${ORIGIN}/index.html`)
  return window
}

/** The game's window, once it is open. */
let gameWindow: electron.BrowserWindow | undefined

/** Once Electron is ready: the game's origin, what it may ask for, the menus and the window. */
function start(): void {
  protocol.handle(SCHEME, serve)
  ipcMain.handle('wormhole:latest-build', latestBuild)
  ipcMain.on('wormhole:quit', quit)
  // Full screen and copying the debug log are all the game asks for.
  const allowed = new Set(['fullscreen', 'clipboard-sanitized-write'])
  session.defaultSession.setPermissionRequestHandler((_contents, permission, grant) =>
    grant(allowed.has(permission)),
  )
  // A window of its own is the game's whole interface; macOS keeps the menus its users expect,
  // with Quit, Hide and copying.
  Menu.setApplicationMenu(
    process.platform === 'darwin'
      ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
      : null,
  )
  gameWindow = openWindow()
}

if (!app.requestSingleInstanceLock()) {
  // The game runs already: the other instance comes to the front instead.
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!gameWindow) return
    if (gameWindow.isMinimized()) gameWindow.restore()
    gameWindow.focus()
  })
  app.on('window-all-closed', () => app.quit())
  void app.whenReady().then(start)
}
