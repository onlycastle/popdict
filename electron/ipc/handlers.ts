import { app, BrowserWindow, shell, systemPreferences } from 'electron'
import type { IpcRouter } from './IpcRouter'
import type { Store } from '../store'
import type { WindowManager } from '../windows/WindowManager'
import type { AuthCallbackBroker } from '../auth/AuthCallbackBroker'
import type { HotkeyManager } from '../hotkey/HotkeyManager'
import type { TrayMenu } from '../tray/TrayMenu'
import { createLogger } from '../../shared/logger'
import { describeExternalAuthUrl } from '../../shared/authUrl'

const log = createLogger('Auth')

export interface IpcDeps {
  store: Store
  windows: WindowManager
  broker: AuthCallbackBroker
  hotkey: HotkeyManager
  tray: TrayMenu
  openFeedback: () => void
}

/** The settings shape the renderer expects, merging stored config with OS state. */
function settingsPayload(store: Store) {
  const cfg = store.getConfig()
  return {
    hotkey: cfg.hotkey,
    lookupSelection: cfg.lookupSelection,
    launchAtLogin: app.getLoginItemSettings().openAtLogin,
  }
}

/** Show the search window and seed it with `word`. */
function seedSearch(windows: WindowManager, word: string): void {
  const trimmed = (word ?? '').trim()
  if (!trimmed) return
  windows.showSearch()
  windows.get('search')?.webContents.send('seed-search', trimmed)
}

/** Register every IPC channel, wiring renderer requests to the injected services. */
export function registerIpcHandlers(router: IpcRouter, deps: IpcDeps): void {
  const { store, windows, broker, hotkey, tray, openFeedback } = deps

  router.handle('get-settings', () => settingsPayload(store))

  router.handle('set-settings', (_e, partial) => {
    const { launchAtLogin, hotkey: _ignoredHotkey, ...storable } = partial ?? {}
    if (typeof launchAtLogin === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: launchAtLogin })
    }
    // Prompt for Accessibility when the user opts into select-to-lookup; the
    // hotkey path only ever checks (never prompts).
    if (storable.lookupSelection === true && process.platform === 'darwin') {
      systemPreferences.isTrustedAccessibilityClient(true)
    }
    store.patch(storable)
    tray.rebuild()
    return settingsPayload(store)
  })

  router.handle('get-history', () => store.getConfig().history)
  router.handle('add-history', (_e, word: string) => store.addHistory(word))
  router.handle('remove-history', (_e, word: string) => store.removeHistory(word))
  router.handle('clear-history', () => { store.clearHistory() })

  router.handle('change-hotkey', (_e, accelerator: string) => {
    const ok = hotkey.register(accelerator)
    if (ok) {
      store.patch({ hotkey: accelerator })
      tray.rebuild()
    } else {
      hotkey.register(store.getConfig().hotkey) // restore previous working hotkey
    }
    return ok
  })

  router.on('send-feedback', () => openFeedback())
  router.on('open-settings', () => windows.open('settings'))
  router.on('open-saved-words', () => windows.open('saved'))
  router.on('lookup-word', (_e, word: string) => seedSearch(windows, word))
  router.on('finish-onboarding', () => {
    store.patch({ onboardingDone: true })
    windows.get('onboarding')?.close()
  })

  // Accessibility permission drives select-to-lookup. Check (no prompt) vs.
  // request (prompts + opens System Settings on first ask). Non-macOS is N/A.
  router.handle('is-accessibility-trusted', () =>
    process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : true
  )
  router.handle('request-accessibility', () =>
    process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(true) : true
  )

  router.handle('consume-auth-callback', () => broker.consume())

  router.handle('open-external-url', async (event, url: string) => {
    log.event('renderer requested external url', describeExternalAuthUrl(url))
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      log.event('blocked non-https external url', describeExternalAuthUrl(url))
      throw new Error('Only HTTPS URLs can be opened externally')
    }
    broker.setTarget(BrowserWindow.fromWebContents(event.sender))
    broker.markAuthInitiated()
    await shell.openExternal(url)
    log.event('external url opened', describeExternalAuthUrl(url))
  })

  router.on('hide-window', () => {
    windows.get('search')?.hide()
  })

  router.on('set-window-height', (_e, height: number) => {
    const win = windows.get('search')
    if (win) {
      const bounds = win.getBounds()
      const newHeight = Math.min(Math.max(height, 128), 600) // Min 128px (chrome rail + input), max 600px
      win.setBounds({ ...bounds, height: newHeight })
    }
  })
}
