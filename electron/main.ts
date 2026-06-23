import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  shell,
  systemPreferences,
  Tray,
} from 'electron'
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
import { createLogger } from '../shared/logger'
import { describeExternalAuthUrl, isAuthCallbackUrl } from '../shared/authUrl'

const log = createLogger('Auth')

let store: ReturnType<typeof createStore>
let trayRef: Tray | null = null

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

// --- Composition root: windows + auth deep-link broker -------------------
// Ordered construction breaks the windows ↔ broker cycle: build windows, then
// the broker that reads them, then hand windows the specs whose afterCreate
// hooks deliver pending auth callbacks via broker.dispatch().
const windows = new WindowManager()
const broker = new AuthCallbackBroker(windows, log)
windows.setSpecs(buildWindowSpecs(() => broker.dispatch()))

installDeepLinkHandlers({ broker, windows, log, hasSingleInstanceLock })
registerWebContentsHardening()

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

function lookupWordInSearch(word: string) {
  const trimmed = (word ?? '').trim()
  if (!trimmed) return
  windows.showSearch()
  windows.get('search')?.webContents.send('seed-search', trimmed)
}

function registerHotkey(accelerator: string): boolean {
  globalShortcut.unregisterAll()
  try {
    const ok = globalShortcut.register(accelerator, () => void onHotkey())
    return ok && globalShortcut.isRegistered(accelerator)
  } catch {
    return false
  }
}

function rebuildTrayMenu() {
  if (!trayRef) return
  const menu = Menu.buildFromTemplate([
    { label: 'Search', accelerator: store.getConfig().hotkey, click: () => windows.showSearch() },
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { label: 'Saved Words…', click: () => windows.open('saved') },
    { label: 'Settings…', click: () => windows.open('settings') },
    { label: 'Open GitHub Issue', click: () => openFeedback() },
    { type: 'separator' },
    { label: 'Quit PopDict', click: () => app.quit() },
  ])
  trayRef.setContextMenu(menu)
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

    ipcMain.handle('get-settings', () => {
      const cfg = store.getConfig()
      return {
        hotkey: cfg.hotkey,
        lookupSelection: cfg.lookupSelection,
        launchAtLogin: app.getLoginItemSettings().openAtLogin,
      }
    })

    ipcMain.handle('set-settings', (_e, partial) => {
      const { launchAtLogin, hotkey: _ignoredHotkey, ...storable } = partial ?? {}
      if (typeof launchAtLogin === 'boolean') {
        app.setLoginItemSettings({ openAtLogin: launchAtLogin })
      }
      // Prompt for Accessibility when the user opts into select-to-lookup; the
      // hotkey path only ever checks (never prompts).
      if (storable.lookupSelection === true && process.platform === 'darwin') {
        systemPreferences.isTrustedAccessibilityClient(true)
      }
      const cfg = store.patch(storable)
      rebuildTrayMenu()
      return {
        hotkey: cfg.hotkey,
        lookupSelection: cfg.lookupSelection,
        launchAtLogin: app.getLoginItemSettings().openAtLogin,
      }
    })

    ipcMain.handle('get-history', () => store.getConfig().history)
    ipcMain.handle('add-history', (_e, word: string) => store.addHistory(word))
    ipcMain.handle('remove-history', (_e, word: string) => store.removeHistory(word))
    ipcMain.handle('clear-history', () => { store.clearHistory() })

    ipcMain.handle('change-hotkey', (_e, accelerator: string) => {
      const ok = registerHotkey(accelerator)
      if (ok) {
        store.patch({ hotkey: accelerator })
        rebuildTrayMenu()
      } else {
        registerHotkey(store.getConfig().hotkey) // restore previous working hotkey
      }
      return ok
    })

    ipcMain.on('send-feedback', () => openFeedback())
    ipcMain.on('open-settings', () => windows.open('settings'))
    ipcMain.on('open-saved-words', () => windows.open('saved'))
    ipcMain.on('lookup-word', (_e, word: string) => lookupWordInSearch(word))
    ipcMain.on('finish-onboarding', () => {
      store.patch({ onboardingDone: true })
      windows.get('onboarding')?.close()
    })
    // Accessibility permission drives select-to-lookup. Check (no prompt) vs.
    // request (prompts + opens System Settings on first ask). Non-macOS is N/A.
    ipcMain.handle('is-accessibility-trusted', () =>
      process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : true
    )
    ipcMain.handle('request-accessibility', () =>
      process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(true) : true
    )
    ipcMain.handle('consume-auth-callback', () => broker.consume())
    ipcMain.handle('open-external-url', async (event, url: string) => {
      log.event('renderer requested external url', describeExternalAuthUrl(url))
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:') {
        log.event('blocked non-https external url', describeExternalAuthUrl(url))
        throw new Error('Only HTTPS URLs can be opened externally')
      }
      broker.setTarget(BrowserWindow.fromWebContents(event.sender))
      await shell.openExternal(url)
      log.event('external url opened', describeExternalAuthUrl(url))
    })

    if (process.platform === 'darwin' && app.dock) {
      app.dock.hide()
    }

    const trayIconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'trayTemplate.png')
      : path.join(__dirname, '../../assets/trayTemplate.png')
    const tray = new Tray(trayIconPath)
    trayRef = tray
    tray.setToolTip('PopDict')
    rebuildTrayMenu()

    const startupHotkey = store.getConfig().hotkey
    if (!registerHotkey(startupHotkey)) {
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

// Handle window hide request from renderer.
ipcMain.on('hide-window', () => {
  windows.get('search')?.hide()
})

// Handle window height adjustment from renderer.
ipcMain.on('set-window-height', (_event, height: number) => {
  const win = windows.get('search')
  if (win) {
    const bounds = win.getBounds()
    const newHeight = Math.min(Math.max(height, 128), 600) // Min 128px (chrome rail + input), max 600px
    win.setBounds({ ...bounds, height: newHeight })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll()
})
