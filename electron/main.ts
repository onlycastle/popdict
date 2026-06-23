import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import { createStore } from './store'
import { initAutoUpdates } from './updater'
import { captureSelection } from './captureSelection'
import { registerWebContentsHardening } from './security'
import { openFeedback } from './feedback'
import { WindowManager } from './windows/WindowManager'
import { buildWindowSpecs } from './windows/windowSpecs'
import { AuthCallbackBroker } from './auth/AuthCallbackBroker'
import { installDeepLinkHandlers, registerAuthProtocol } from './auth/deepLinkProtocol'
import { HotkeyManager } from './hotkey/HotkeyManager'
import { TrayMenu } from './tray/TrayMenu'
import { IpcRouter } from './ipc/IpcRouter'
import { registerIpcHandlers } from './ipc/handlers'
import { createLogger } from '../shared/logger'
import { isAuthCallbackUrl } from '../shared/authUrl'

const log = createLogger('Auth')

let store: ReturnType<typeof createStore>

// Disable GPU acceleration for better transparency support.
// This needs to be called before app is ready.
if (app) {
  app.setName('PopDict')
  app.disableHardwareAcceleration()
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
}

// --- Composition root ----------------------------------------------------
// Ordered construction breaks the windows ↔ broker cycle: build windows, then
// the broker that reads them, then hand windows the specs whose afterCreate
// hooks deliver pending auth callbacks via broker.dispatch().
const windows = new WindowManager()
const broker = new AuthCallbackBroker(windows, log)
windows.setSpecs(buildWindowSpecs(() => broker.dispatch()))

async function onHotkey() {
  const search = windows.get('search')
  if (!search) return
  if (search.isVisible()) {
    search.hide()
    return
  }
  // Capture the selection BEFORE showing our window, while the other app still
  // has focus. Skipped (instant) when the feature is off or unsupported.
  let seed: string | null = null
  if (store.getConfig().lookupSelection) {
    seed = await captureSelection()
  }
  windows.showSearch()
  if (seed) search.webContents.send('seed-search', seed)
}

const hotkey = new HotkeyManager(() => void onHotkey())

installDeepLinkHandlers({ broker, windows, log, hasSingleInstanceLock })
registerWebContentsHardening()

function trayIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'trayTemplate.png')
    : path.join(__dirname, '../../assets/trayTemplate.png')
}

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
    registerAuthProtocol(log)

    store = createStore(path.join(app.getPath('userData'), 'popdict-config.json'))

    windows.open('search')
    initAutoUpdates()

    if (!store.getConfig().onboardingDone) {
      windows.open('onboarding')
    }

    const tray = new TrayMenu({ store, windows, openFeedback, iconPath: trayIconPath() })
    tray.init()

    registerIpcHandlers(new IpcRouter(), { store, windows, broker, hotkey, tray, openFeedback })

    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide()
    }

    const startupHotkey = store.getConfig().hotkey
    if (!hotkey.register(startupHotkey)) {
      console.log('Global shortcut registration failed for', startupHotkey)
    }

    const initialAuthCallbackUrl = process.argv.find((arg) => isAuthCallbackUrl(arg))
    if (initialAuthCallbackUrl) {
      broker.receive(initialAuthCallbackUrl)
    }

    if (broker.hasPending) {
      windows.open('settings')
      broker.dispatch()
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windows.open('search')
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  hotkey.unregisterAll()
})
