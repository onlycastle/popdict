import { app, BrowserWindow, Notification, powerMonitor } from 'electron'
import { randomUUID } from 'node:crypto'
import * as path from 'path'
import { createStore } from './store'
import { createUpdateManager } from './updater'
import {
  notifyUpdateReady,
  showManualCheckResultDialog,
  showUpdateReadyDialog,
} from './updateNotifications'
import { registerWebContentsHardening } from './security'
import { WindowManager } from './windows/WindowManager'
import { buildWindowSpecs } from './windows/windowSpecs'
import { AuthCallbackBroker } from './auth/AuthCallbackBroker'
import { installDeepLinkHandlers, registerAuthProtocol } from './auth/deepLinkProtocol'
import { HotkeyManager } from './hotkey/HotkeyManager'
import { TrayMenu } from './tray/TrayMenu'
import { IpcRouter } from './ipc/IpcRouter'
import { registerIpcHandlers } from './ipc/handlers'
import { createLogger } from '../shared/logger'
import { isAuthCallbackUrl, isQuizDeepLink } from '../shared/authUrl'
import { LookupCache } from './lookupCache'
import { DueCountBroker } from './reminders/DueCountBroker'
import { ReviewReminderScheduler } from './reminders/ReviewReminderScheduler'

const log = createLogger('Auth')
const analyticsSessionId = randomUUID()

let store: ReturnType<typeof createStore>
let dueCountBroker: DueCountBroker | null = null
let reminderScheduler: ReviewReminderScheduler | null = null
let timezoneTimer: ReturnType<typeof setInterval> | null = null

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

function showFeedback(): void {
  const win = windows.open('settings')
  const openDialog = () => win.webContents.send('open-feedback')
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', openDialog)
  else openDialog()
  win.show()
  win.focus()
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
    const lookupCache = new LookupCache(
      path.join(app.getPath('userData'), 'lookup-cache-v1.json')
    )
    dueCountBroker = new DueCountBroker()
    reminderScheduler = new ReviewReminderScheduler({
      getState: () => {
        const config = store.getConfig()
        return {
          settings: config.reviewReminders,
          lastFiredWindow: config.reviewReminderLastWindow,
        }
      },
      markFired: (windowId) => { store.patch({ reviewReminderLastWindow: windowId }) },
      requestDueCount: () => dueCountBroker!.request(windows.get('search')),
      notify: (count) => {
        if (!Notification.isSupported()) return
        const notification = new Notification({
          title: 'Words due for review',
          body: `${count} ${count === 1 ? 'word is' : 'words are'} due.`,
          silent: false,
        })
        notification.on('click', () => windows.open('review'))
        notification.show()
      },
    })

    // tray is referenced from the updater hooks, which only fire after both
    // exist — declare first so the closures capture the binding.
    let tray: TrayMenu | null = null

    const updater = createUpdateManager({
      onUpdateReady: (version, { manual }) => {
        tray?.setUpdateReady(version)
        if (manual) void showUpdateReadyDialog(version, () => updater.installUpdate())
        else notifyUpdateReady(version, () => updater.installUpdate())
      },
      onManualCheckResult: (result) => void showManualCheckResultDialog(result, app.getVersion()),
    })
    const updatesEnabled = updater.init()

    tray = new TrayMenu({
      store,
      windows,
      showFeedback,
      iconPath: trayIconPath(),
      updates: updatesEnabled
        ? { checkNow: () => updater.checkNow(), installUpdate: () => updater.installUpdate() }
        : null,
    })
    tray.init()

    registerIpcHandlers(new IpcRouter(), {
      store,
      windows,
      broker,
      hotkey,
      tray,
      analyticsSessionId,
      lookupCache,
      dueCountBroker,
      reminderScheduler,
    })

    const searchWindow = windows.open('search')
    if (searchWindow.webContents.isLoading()) {
      searchWindow.webContents.once('did-finish-load', () => reminderScheduler?.recalculate())
    } else {
      reminderScheduler.recalculate()
    }

    powerMonitor.on('resume', () => reminderScheduler?.recalculate())
    let timezoneOffset = new Date().getTimezoneOffset()
    timezoneTimer = setInterval(() => {
      const nextOffset = new Date().getTimezoneOffset()
      if (nextOffset !== timezoneOffset) {
        timezoneOffset = nextOffset
        reminderScheduler?.recalculate()
      }
    }, 60_000)
    timezoneTimer.unref?.()

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

    const initialQuizUrl = process.argv.find((arg) => isQuizDeepLink(arg))
    if (initialQuizUrl) {
      windows.open('review')
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
  reminderScheduler?.stop()
  dueCountBroker?.clear()
  if (timezoneTimer) clearInterval(timezoneTimer)
})
