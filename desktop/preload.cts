/*
 * Runs in the game's page before it loads, in a sandbox: it tells the page that it runs in the
 * desktop app, and on which system (src/ui/desktop.ts). It hands over nothing else.
 */
import electron = require('electron')

electron.contextBridge.exposeInMainWorld('wormholeDesktop', { platform: process.platform })
