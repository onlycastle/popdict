import { app, BrowserWindow, shell } from 'electron'
import type { IpcRouter } from './IpcRouter'
import type { Store } from '../store'
import type { WindowManager } from '../windows/WindowManager'
import type { AuthCallbackBroker } from '../auth/AuthCallbackBroker'
import type { HotkeyManager } from '../hotkey/HotkeyManager'
import type { TrayMenu } from '../tray/TrayMenu'
import { createLogger } from '../../shared/logger'
import { describeExternalAuthUrl, isAllowedExternalAuthUrl } from '../../shared/authUrl'
import type { FeedbackOpenResult, FeedbackPayload } from '../../shared/feedback'

const log = createLogger('Auth')

export interface IpcDeps {
  store: Store
  windows: WindowManager
  broker: AuthCallbackBroker
  hotkey: HotkeyManager
  tray: TrayMenu
  openFeedback: (payload?: FeedbackPayload) => Promise<FeedbackOpenResult> | FeedbackOpenResult
}

/** The settings shape the renderer expects, merging stored config with OS state. */
function settingsPayload(store: Store) {
  const cfg = store.getConfig()
  return {
    hotkey: cfg.hotkey,
    launchAtLogin: app.getLoginItemSettings().openAtLogin,
    signInNudgeDismissedAt: cfg.signInNudgeDismissedAt,
    translationLanguage: cfg.translationLanguage,
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
  router.handle('get-app-version', () => app.getVersion())

  router.handle('set-settings', (_e, partial) => {
    const { launchAtLogin, hotkey: _ignoredHotkey, ...storable } = partial ?? {}
    if (typeof launchAtLogin === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: launchAtLogin })
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

  router.handle('send-feedback', (_e, payload?: FeedbackPayload) => openFeedback(payload))
  router.on('open-settings', () => windows.open('settings'))
  router.on('open-saved-words', () => windows.open('saved'))
  router.on('open-review', () => windows.open('review'))
  router.on('lookup-word', (_e, word: string) => seedSearch(windows, word))
  router.on('finish-onboarding', () => {
    store.patch({ onboardingDone: true })
    windows.get('onboarding')?.close()
  })

  router.handle('consume-auth-callback', () => broker.consume())

  router.handle('open-external-url', async (event, url: string) => {
    log.event('renderer requested external url', describeExternalAuthUrl(url))
    if (!isAllowedExternalAuthUrl(url)) {
      log.event('blocked external url', describeExternalAuthUrl(url))
      throw new Error('Only the Supabase auth host can be opened externally')
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
      const newHeight = Math.min(Math.max(height, 64), 600) // Min 64px (the bare search bar), max 600px
      win.setBounds({ ...bounds, height: newHeight })
    }
  })
}
