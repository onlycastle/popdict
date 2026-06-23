import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  screen,
  shell,
  systemPreferences,
  Tray,
} from 'electron'
import * as path from 'path'
import { execFile } from 'node:child_process'
import { createStore } from './store'
import { sanitizeSelection } from './selection'
import { initAutoUpdates } from './updater'

let store: ReturnType<typeof createStore>

const AUTH_PROTOCOL = 'popdict'
const GITHUB_REPO = process.env.POPDICT_GITHUB_REPO || ''

let mainWindow: BrowserWindow | null = null
let trayRef: Tray | null = null
let settingsWindow: BrowserWindow | null = null
let savedWordsWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let pendingAuthCallbackUrl: string | null = null
let deliveredAuthCallbackUrl: string | null = null
let authCallbackTargetWindow: BrowserWindow | null = null

const SEARCH_WINDOW_TOP_OFFSET = 32

function formatAuthDebugDetails(details?: Record<string, unknown>): string {
  if (!details) return ''
  try {
    return JSON.stringify(details)
  } catch {
    return '[unserializable details]'
  }
}

function authDebug(event: string, details?: Record<string, unknown>) {
  console.log(`[Auth] ${event} ${formatAuthDebugDetails(details)}`.trim())
}

function describeAuthUrl(rawUrl: string): Record<string, unknown> {
  try {
    const url = new URL(rawUrl)
    const search = url.searchParams
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    return {
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname,
      searchKeys: Array.from(search.keys()),
      hashKeys: Array.from(hash.keys()),
      hasCode: search.has('code'),
      hasAccessToken: search.has('access_token') || hash.has('access_token'),
      hasRefreshToken: search.has('refresh_token') || hash.has('refresh_token'),
      error: search.get('error') ?? hash.get('error') ?? null,
      errorDescription: search.get('error_description') ?? hash.get('error_description') ?? null,
    }
  } catch {
    return { invalidUrl: true }
  }
}

function describeExternalUrl(rawUrl: string): Record<string, unknown> {
  try {
    const url = new URL(rawUrl)
    const redirectTo = url.searchParams.get('redirect_to')
    let redirectSummary: Record<string, unknown> | null = null
    if (redirectTo) {
      redirectSummary = describeAuthUrl(redirectTo)
    }

    return {
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname,
      searchKeys: Array.from(url.searchParams.keys()),
      redirectTo: redirectSummary,
    }
  } catch {
    return { invalidUrl: true }
  }
}

// Disable GPU acceleration for better transparency support
// This needs to be called before app is ready
if (app) {
  app.setName('PopDict')
  app.disableHardwareAcceleration()
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
}

function isAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === `${AUTH_PROTOCOL}:` && parsed.hostname === 'auth'
  } catch {
    return false
  }
}

function registerAuthProtocol() {
  if (process.defaultApp && process.argv.length >= 2) {
    const ok = app.setAsDefaultProtocolClient(AUTH_PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ])
    authDebug('register protocol default app', { ok, protocol: AUTH_PROTOCOL })
    return
  }

  const ok = app.setAsDefaultProtocolClient(AUTH_PROTOCOL)
  authDebug('register protocol packaged app', { ok, protocol: AUTH_PROTOCOL })
}

function dispatchPendingAuthCallback() {
  if (!pendingAuthCallbackUrl) return
  if (deliveredAuthCallbackUrl === pendingAuthCallbackUrl) {
    authDebug('skip duplicate callback delivery')
    return
  }
  const targetWindow =
    authCallbackTargetWindow && !authCallbackTargetWindow.webContents.isDestroyed()
      ? authCallbackTargetWindow
      : settingsWindow ?? mainWindow
  if (!targetWindow || targetWindow.webContents.isDestroyed()) {
    authDebug('callback pending but no target window')
    return
  }

  if (targetWindow.webContents.isLoading()) {
    authDebug('callback target loading; waiting')
    targetWindow.webContents.once('did-finish-load', dispatchPendingAuthCallback)
    return
  }

  authDebug('deliver callback to renderer', describeAuthUrl(pendingAuthCallbackUrl))
  targetWindow.webContents.send('auth-callback', pendingAuthCallbackUrl)
  deliveredAuthCallbackUrl = pendingAuthCallbackUrl

  if (targetWindow.isMinimized()) targetWindow.restore()
  targetWindow.show()
  targetWindow.focus()
}

function handleAuthCallback(url: string) {
  if (!isAuthCallbackUrl(url)) {
    authDebug('ignore non-auth callback url', describeAuthUrl(url))
    return
  }
  authDebug('received auth callback', describeAuthUrl(url))
  pendingAuthCallbackUrl = url
  deliveredAuthCallbackUrl = null

  if (!app.isReady()) {
    authDebug('app not ready; callback stored')
    return
  }
  dispatchPendingAuthCallback()
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  authDebug('macOS open-url event', describeAuthUrl(url))
  handleAuthCallback(url)
})

// Renderer/navigation hardening (applies to every window the app creates).
// Fuses harden the binary but do not cover renderer navigation; deny new
// windows and block in-app navigation to remote origins. External https links
// are handed to the system browser instead.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol === 'https:') {
        void shell.openExternal(url)
      }
    } catch {
      // ignore malformed URLs
    }
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    const devServer = MAIN_WINDOW_VITE_DEV_SERVER_URL
    const isDevOrigin = devServer ? url.startsWith(devServer) : false
    const isLocalFile = url.startsWith('file://')
    if (isDevOrigin || isLocalFile) return
    event.preventDefault()
    try {
      if (new URL(url).protocol === 'https:') void shell.openExternal(url)
    } catch {
      // ignore malformed URLs
    }
  })
})

if (hasSingleInstanceLock) {
  app.on('second-instance', (_event, argv) => {
    const callbackUrl = argv.find((arg) => isAuthCallbackUrl(arg))
    if (callbackUrl) {
      authDebug('second instance auth callback', describeAuthUrl(callbackUrl))
      handleAuthCallback(callbackUrl)
    } else {
      authDebug('second instance without auth callback')
      showSearchWindow()
    }
  })
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
    displayY + SEARCH_WINDOW_TOP_OFFSET
  )
  mainWindow.show()
  mainWindow.focus()
  mainWindow.webContents.send('focus-search')
}

// --- Select-text → instant lookup (macOS) -------------------------------
// Sentinel written to the clipboard so we can tell whether ⌘C actually
// produced a copy (vs. there being no selection / the copy not landing).
const SELECTION_PROBE = '__POPDICT_SELECTION_PROBE__'

/**
 * Capture the current selection from the frontmost app by synthesizing ⌘C,
 * preserving and restoring the user's existing clipboard. Returns null when
 * there is no usable selection, Accessibility isn't granted, or anything fails
 * — callers then fall back to manual typing. macOS only.
 */
function captureSelectionText(): Promise<string | null> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') return resolve(null)
    // Check (do not prompt) — prompting happens when the user enables the
    // feature in Settings, not on every hotkey press.
    if (!systemPreferences.isTrustedAccessibilityClient(false)) return resolve(null)

    const previousClipboard = clipboard.readText()
    clipboard.writeText(SELECTION_PROBE)

    const restore = () => clipboard.writeText(previousClipboard)

    execFile(
      'osascript',
      ['-e', 'tell application "System Events" to keystroke "c" using command down'],
      (error) => {
        if (error) {
          restore()
          return resolve(null)
        }
        const deadline = Date.now() + 300
        const poll = () => {
          const current = clipboard.readText()
          if (current !== SELECTION_PROBE) {
            restore()
            return resolve(sanitizeSelection(current))
          }
          if (Date.now() > deadline) {
            restore()
            return resolve(null)
          }
          setTimeout(poll, 25)
        }
        setTimeout(poll, 25)
      }
    )
  })
}

async function onHotkey() {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    mainWindow.hide()
    return
  }
  // Capture the selection BEFORE showing our window, while the other app still
  // has focus. Skipped (instant) when the feature is off or unsupported.
  let seed: string | null = null
  if (store.getConfig().lookupSelection) {
    seed = await captureSelectionText()
  }
  showSearchWindow()
  if (seed && mainWindow) mainWindow.webContents.send('seed-search', seed)
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 560,
    resizable: false,
    title: 'PopDict Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/settings`)
  } else {
    settingsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: 'settings' }
    )
  }

  settingsWindow.webContents.once('did-finish-load', dispatchPendingAuthCallback)

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function openSavedWordsWindow() {
  if (savedWordsWindow) {
    savedWordsWindow.focus()
    return
  }
  savedWordsWindow = new BrowserWindow({
    width: 420,
    height: 600,
    resizable: true,
    minWidth: 360,
    minHeight: 400,
    title: 'PopDict — Saved Words',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    savedWordsWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/saved`)
  } else {
    savedWordsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: 'saved' }
    )
  }

  savedWordsWindow.on('closed', () => {
    savedWordsWindow = null
  })
}

function openOnboardingWindow() {
  if (onboardingWindow) {
    onboardingWindow.focus()
    return
  }
  onboardingWindow = new BrowserWindow({
    width: 460,
    height: 560,
    resizable: false,
    title: 'Welcome to PopDict',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    onboardingWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/onboarding`)
  } else {
    onboardingWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: 'onboarding' }
    )
  }

  onboardingWindow.on('closed', () => {
    onboardingWindow = null
  })
}

function lookupWordInSearch(word: string) {
  const trimmed = (word ?? '').trim()
  if (!trimmed || !mainWindow) return
  showSearchWindow()
  mainWindow.webContents.send('seed-search', trimmed)
}

function openFeedback() {
  const version = app.getVersion()
  if (!GITHUB_REPO) {
    console.warn('POPDICT_GITHUB_REPO is unset; cannot open GitHub Issues feedback URL.')
    return
  }

  const params = new URLSearchParams({
    title: `PopDict feedback (${version})`,
    body: `## Feedback\n\n\n## Version\n${version}\n`,
  })
  shell.openExternal(`https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`)
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
    { label: 'Search', accelerator: store.getConfig().hotkey, click: () => showSearchWindow() },
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { label: 'Saved Words…', click: () => openSavedWordsWindow() },
    { label: 'Settings…', click: () => openSettingsWindow() },
    { label: 'Open GitHub Issue', click: () => openFeedback() },
    { type: 'separator' },
    { label: 'Quit PopDict', click: () => app.quit() },
  ])
  trayRef.setContextMenu(menu)
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 128,
    minHeight: 128,
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
      nodeIntegration: false,
    },
  })

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    // Open DevTools in development
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  mainWindow.webContents.once('did-finish-load', dispatchPendingAuthCallback)

  // Make window visible on all workspaces (Spaces/Desktops)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setAlwaysOnTop(true, 'floating')

  // Position the full search dialog near the top of the screen.
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize
  const { x: displayX, y: displayY } = primaryDisplay.workArea
  const windowBounds = mainWindow.getBounds()
  mainWindow.setPosition(
    displayX + Math.round((screenWidth - windowBounds.width) / 2),
    displayY + SEARCH_WINDOW_TOP_OFFSET
  )

  // Hide window when it loses focus
  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide()
    }
  })

  // Add error logging for debugging
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details.reason, details.exitCode)
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })

  // Log any console messages from renderer for debugging
  mainWindow.webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
    console.log(`[Renderer ${level}]:`, message, `(${sourceId}:${lineNumber})`)
  })
}

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
    registerAuthProtocol()

    store = createStore(path.join(app.getPath('userData'), 'popdict-config.json'))

    createWindow()
    initAutoUpdates()

    if (!store.getConfig().onboardingDone) {
      openOnboardingWindow()
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
    ipcMain.on('open-settings', () => openSettingsWindow())
    ipcMain.on('open-saved-words', () => openSavedWordsWindow())
    ipcMain.on('lookup-word', (_e, word: string) => lookupWordInSearch(word))
    ipcMain.on('finish-onboarding', () => {
      store.patch({ onboardingDone: true })
      if (onboardingWindow) onboardingWindow.close()
    })
    // Accessibility permission drives select-to-lookup. Check (no prompt) vs.
    // request (prompts + opens System Settings on first ask). Non-macOS is N/A.
    ipcMain.handle('is-accessibility-trusted', () =>
      process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : true
    )
    ipcMain.handle('request-accessibility', () =>
      process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(true) : true
    )
    ipcMain.handle('consume-auth-callback', () => {
      const callbackUrl = pendingAuthCallbackUrl
      authDebug('renderer consumed callback', {
        hasCallback: Boolean(callbackUrl),
        ...(callbackUrl ? describeAuthUrl(callbackUrl) : {}),
      })
      pendingAuthCallbackUrl = null
      deliveredAuthCallbackUrl = null
      authCallbackTargetWindow = null
      return callbackUrl
    })
    ipcMain.handle('open-external-url', async (event, url: string) => {
      authDebug('renderer requested external url', describeExternalUrl(url))
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:') {
        authDebug('blocked non-https external url', describeExternalUrl(url))
        throw new Error('Only HTTPS URLs can be opened externally')
      }
      authCallbackTargetWindow = BrowserWindow.fromWebContents(event.sender)
      await shell.openExternal(url)
      authDebug('external url opened', describeExternalUrl(url))
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
      handleAuthCallback(initialAuthCallbackUrl)
    }

    if (pendingAuthCallbackUrl) {
      openSettingsWindow()
      dispatchPendingAuthCallback()
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

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
    const newHeight = Math.min(Math.max(height, 128), 600) // Min 128px (chrome rail + input), max 600px
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
