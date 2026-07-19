import { app, Menu, Tray } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import type { Store } from '../store'
import type { WindowManager } from '../windows/WindowManager'

export interface TrayUpdateActions {
  checkNow: () => void
  installUpdate: () => void
}

export interface TrayMenuDeps {
  store: Store
  windows: WindowManager
  showFeedback: () => void
  iconPath: string
  /** null when auto-update is disabled (dev builds, unconfigured repo). */
  updates: TrayUpdateActions | null
}

/** Owns the menu-bar tray icon and (re)builds its context menu from injected deps. */
export class TrayMenu {
  private tray: Tray | null = null
  private updateReadyVersion: string | null = null

  constructor(private deps: TrayMenuDeps) {}

  /** Create the tray icon and build its menu. Call once, after app is ready. */
  init(): void {
    this.tray = new Tray(this.deps.iconPath)
    this.tray.setToolTip('PopDict')
    this.rebuild()
  }

  /** A downloaded update is staged — surface the restart item at the top. */
  setUpdateReady(version: string): void {
    this.updateReadyVersion = version
    this.rebuild()
  }

  /** Rebuild the menu — call after the hotkey, login setting, or update state changes. */
  rebuild(): void {
    if (!this.tray) return
    const { store, windows, showFeedback, updates } = this.deps

    const template: MenuItemConstructorOptions[] = []

    if (updates && this.updateReadyVersion !== null) {
      template.push(
        {
          label: this.updateReadyVersion
            ? `Restart to Update to v${this.updateReadyVersion}`
            : 'Restart to Update',
          click: () => updates.installUpdate(),
        },
        { type: 'separator' }
      )
    }

    template.push(
      { label: 'Search', accelerator: store.getConfig().hotkey, click: () => windows.showSearch() },
      { type: 'separator' },
      {
        label: 'Launch at Login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { label: 'Saved Words…', click: () => windows.open('saved') },
      { label: 'Settings…', click: () => windows.open('settings') }
    )

    if (updates) {
      template.push({ label: 'Check for Updates…', click: () => updates.checkNow() })
    }

    template.push(
      { label: 'Send Feedback...', click: () => showFeedback() },
      { type: 'separator' },
      { label: 'Quit PopDict', click: () => app.quit() }
    )

    this.tray.setContextMenu(Menu.buildFromTemplate(template))
  }
}
