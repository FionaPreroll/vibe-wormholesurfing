/*
 * Runs in the game's page before it loads, in a sandbox: it tells the page that it runs in the
 * desktop app, on which system and for which processor, and lets it ask the main process for the
 * newest build's number and to quit (src/ui/desktop.ts). It hands over nothing else.
 */
import electron = require('electron')

electron.contextBridge.exposeInMainWorld('wormholeDesktop', {
  platform: process.platform,
  arch: process.arch,
  latestBuild: (): Promise<unknown> => electron.ipcRenderer.invoke('wormhole:latest-build'),
  quit: (): void => electron.ipcRenderer.send('wormhole:quit'),
})
