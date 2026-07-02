import { screen, type BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import * as path from 'path'

export type WindowId = 'search' | 'settings' | 'saved' | 'onboarding'

export interface WindowSpec {
  /** BrowserWindow constructor options (size, frame, vibrancy, …) as data. */
  options: BrowserWindowConstructorOptions
  /** Route hash for the renderer: '' for search, else 'settings' | 'saved' | 'onboarding'. */
  hash: string
  /** Focus the existing window instead of creating a second one. */
  singleton: boolean
  /** Bespoke wiring run once, right after the window is created + load starts. */
  afterCreate?: (win: BrowserWindow) => void
}

export const SEARCH_WINDOW_TOP_OFFSET = 32

const sharedWebPreferences: BrowserWindowConstructorOptions['webPreferences'] = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
}

// Native macOS material for the secondary windows (Settings / Saved /
// Onboarding): traffic lights inset into the content (no stock title bar) over
// an under-window vibrancy the renderer tints with a translucent warm wash
// (`.window` in index.css). The views reserve drag space via `.titlebar-drag`.
const secondaryWindowChrome: Partial<BrowserWindowConstructorOptions> = {
  titleBarStyle: 'hiddenInset',
  vibrancy: 'under-window',
}

/**
 * Declarative definitions for every app window. `onAuthReady` is attached (via
 * afterCreate) to the windows that can receive an OAuth deep-link callback —
 * search and settings — so a pending callback is delivered once they load.
 */
export function buildWindowSpecs(onAuthReady: () => void): Record<WindowId, WindowSpec> {
  return {
    search: {
      hash: '',
      singleton: true,
      options: {
        width: 800,
        height: 64,
        minHeight: 64,
        maxHeight: 600,
        transparent: true,
        frame: false,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        vibrancy: 'hud', // macOS only — blurred background
        visualEffectState: 'active',
        show: false, // shown on hotkey via WindowManager.showSearch()
        webPreferences: sharedWebPreferences,
      },
      afterCreate: (win) => {
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
          win.webContents.openDevTools({ mode: 'detach' })
        }
        win.webContents.once('did-finish-load', onAuthReady)

        // Visible on all Spaces/Desktops, floating above other windows.
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        win.setAlwaysOnTop(true, 'floating')

        // Initial position near the top of the primary display.
        const primaryDisplay = screen.getPrimaryDisplay()
        const { width: screenWidth } = primaryDisplay.workAreaSize
        const { x: displayX, y: displayY } = primaryDisplay.workArea
        const bounds = win.getBounds()
        win.setPosition(
          displayX + Math.round((screenWidth - bounds.width) / 2),
          displayY + SEARCH_WINDOW_TOP_OFFSET
        )

        // Hide on focus loss, but stay visible while detached DevTools is focused.
        // isDevToolsOpened() stays true for the whole dev session.
        win.on('blur', () => {
          if (!win.isDestroyed() && !win.webContents.isDevToolsFocused()) win.hide()
        })

        // Diagnostics.
        win.webContents.on('render-process-gone', (_event, details) => {
          console.error('Renderer process gone:', details.reason, details.exitCode)
        })
        win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
          console.error('Failed to load:', errorCode, errorDescription)
        })
        win.webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
          console.log(`[Renderer ${level}]:`, message, `(${sourceId}:${lineNumber})`)
        })
      },
    },

    settings: {
      hash: 'settings',
      singleton: true,
      options: {
        width: 480,
        height: 560,
        resizable: false,
        title: 'PopDict Settings',
        ...secondaryWindowChrome,
        webPreferences: sharedWebPreferences,
      },
      afterCreate: (win) => {
        win.webContents.once('did-finish-load', onAuthReady)
      },
    },

    saved: {
      hash: 'saved',
      singleton: true,
      options: {
        width: 420,
        height: 600,
        resizable: true,
        minWidth: 360,
        minHeight: 400,
        title: 'PopDict — Saved Words',
        ...secondaryWindowChrome,
        webPreferences: sharedWebPreferences,
      },
    },

    onboarding: {
      hash: 'onboarding',
      singleton: true,
      options: {
        width: 460,
        height: 560,
        resizable: false,
        title: 'Welcome to PopDict',
        ...secondaryWindowChrome,
        webPreferences: sharedWebPreferences,
      },
    },
  }
}
