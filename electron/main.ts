import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import { createStore } from './store'
import { initAutoUpdates } from './updater'
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

function onHotkey() {
  const search = windows.get('search')
  if (!search) return
  if (search.isVisible()) {
    search.hide()
    return
  }
  // Pop the search bar up, focused and ready to type.
  windows.showSearch()
}

const hotkey = new HotkeyManager(() => void onHotkey())

installDeepLinkHandlers({ broker, windows, log, hasSingleInstanceLock })
registerWebContentsHardening()

function trayIconPath(): string {
  // Colored (non-template) icon: the filename must NOT end in `Template`, or
  // macOS flattens it to a monochrome alpha mask and discards the brand colors.
  // Electron auto-loads the `@2x` sibling for Retina menu bars.
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'trayIcon.png')
    : path.join(__dirname, '../../assets/trayIcon.png')
}

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
    // Hide the Dock icon BEFORE any window opens so the menu-bar app never
    // flashes a Dock tile on first launch. The packaged build also sets
    // LSUIElement=true (forge.config.ts), which makes this redundant there;
    // keeping the call preserves the no-Dock behavior in dev (`npm start`),
    // where the app runs from the plain Electron binary with no Info.plist.
    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide()
    }

    registerAuthProtocol(log)

    store = createStore(path.join(app.getPath('userData'), 'popdict-config.json'))

    const tray = new TrayMenu({ store, windows, openFeedback, iconPath: trayIconPath() })
    tray.init()

    registerIpcHandlers(new IpcRouter(), { store, windows, broker, hotkey, tray, openFeedback })

    windows.open('search')
    initAutoUpdates()

    if (!store.getConfig().onboardingDone) {
      windows.open('onboarding')
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
