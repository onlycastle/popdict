import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen } from 'electron'
import * as path from 'path'
import { createStore } from './store'

const store = createStore(path.join(app.getPath('userData'), 'popdict-config.json'))

let mainWindow: BrowserWindow | null = null
let trayRef: Tray | null = null

// Disable GPU acceleration for better transparency support
// This needs to be called before app is ready
if (app) {
  app.disableHardwareAcceleration()
}

function showSearchWindow() {
  if (!mainWindow) return
  const cursorPoint = screen.getCursorScreenPoint()
  const currentDisplay = screen.getDisplayNearestPoint(cursorPoint)
  const { width: screenWidth } = currentDisplay.workAreaSize
  const { x: displayX, y: displayY } = currentDisplay.workArea
  const windowBounds = mainWindow.getBounds()
  mainWindow.setPosition(
    displayX + Math.round((screenWidth - windowBounds.width) / 2),
    displayY + 80
  )
  mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.send('focus-search')
}

function toggleSearchWindow() {
  if (!mainWindow) return
  if (mainWindow.isVisible()) mainWindow.hide()
  else showSearchWindow()
}

// Temporary stubs — implemented in later tasks (9 and 10).
function openSettingsWindow() { /* implemented in Task 9 */ }
function openFeedback() { /* implemented in Task 10 */ }

function rebuildTrayMenu() {
  if (!trayRef) return
  const menu = Menu.buildFromTemplate([
    { label: 'Search', accelerator: store.getConfig().hotkey, click: () => showSearchWindow() },
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { label: 'Settings…', click: () => openSettingsWindow() },
    { label: 'Send Feedback', click: () => openFeedback() },
    { type: 'separator' },
    { label: 'Quit PopDict', click: () => app.quit() },
  ])
  trayRef.setContextMenu(menu)
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 80,
    minHeight: 80,
    maxHeight: 600,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    vibrancy: 'hud', // macOS only - gives the window a blurred background
    visualEffectState: 'active',
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    // Open DevTools in development
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  // Make window visible on all workspaces (Spaces/Desktops)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setAlwaysOnTop(true, 'floating')

  // Position window at top-center of screen
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize
  const windowBounds = mainWindow.getBounds()
  mainWindow.setPosition(
    Math.round((screenWidth - windowBounds.width) / 2),
    80 // 80px from top
  )

  // Hide window when it loses focus
  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide()
    }
  })

  // Add error logging for debugging
  mainWindow.webContents.on('crashed', (event) => {
    console.error('Renderer process crashed:', event)
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })

  // Log any console messages from renderer for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}]:`, message, `(${sourceId}:${line})`)
  })
}

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('get-settings', () => {
    const cfg = store.getConfig()
    return {
      hotkey: cfg.hotkey,
      stands4Uid: cfg.stands4Uid,
      stands4Token: cfg.stands4Token,
      launchAtLogin: app.getLoginItemSettings().openAtLogin,
    }
  })

  ipcMain.handle('set-settings', (_e, partial) => {
    const { launchAtLogin, ...storable } = partial ?? {}
    if (typeof launchAtLogin === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: launchAtLogin })
    }
    const cfg = store.patch(storable)
    rebuildTrayMenu()
    return {
      hotkey: cfg.hotkey,
      stands4Uid: cfg.stands4Uid,
      stands4Token: cfg.stands4Token,
      launchAtLogin: app.getLoginItemSettings().openAtLogin,
    }
  })

  ipcMain.handle('get-history', () => store.getConfig().history)
  ipcMain.handle('add-history', (_e, word: string) => store.addHistory(word))
  ipcMain.handle('clear-history', () => { store.clearHistory() })
  ipcMain.handle('get-stands4-credentials', () => {
    const cfg = store.getConfig()
    return { uid: cfg.stands4Uid, token: cfg.stands4Token }
  })

  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide()
  }

  const tray = new Tray(path.join(__dirname, '../../assets/trayTemplate.png'))
  trayRef = tray
  tray.setToolTip('PopDict')
  rebuildTrayMenu()

  // Register global shortcut: Cmd+Shift+Space
  const ret = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    toggleSearchWindow()
  })

  if (!ret) {
    console.log('Global shortcut registration failed')
  }

  // Check if shortcut is registered
  console.log('Shortcut registered:', globalShortcut.isRegistered('CommandOrControl+Shift+Space'))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Handle window hide request from renderer
ipcMain.on('hide-window', () => {
  if (mainWindow) {
    mainWindow.hide()
  }
})

// Handle window height adjustment from renderer
ipcMain.on('set-window-height', (_event, height: number) => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds()
    const newHeight = Math.min(Math.max(height, 80), 600) // Min 80px, max 600px
    mainWindow.setBounds({
      ...bounds,
      height: newHeight
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll()
})
