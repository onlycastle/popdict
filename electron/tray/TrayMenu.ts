import { app, Menu, Tray } from 'electron'
import type { Store } from '../store'
import type { WindowManager } from '../windows/WindowManager'

export interface TrayMenuDeps {
  store: Store
  windows: WindowManager
  openFeedback: () => void
  iconPath: string
}

/** Owns the menu-bar tray icon and (re)builds its context menu from injected deps. */
export class TrayMenu {
  private tray: Tray | null = null

  constructor(private deps: TrayMenuDeps) {}

  /** Create the tray icon and build its menu. Call once, after app is ready. */
  init(): void {
    this.tray = new Tray(this.deps.iconPath)
    this.tray.setToolTip('PopDict')
    this.rebuild()
  }

  /** Rebuild the menu — call after the hotkey or launch-at-login setting changes. */
  rebuild(): void {
    if (!this.tray) return
    const { store, windows, openFeedback } = this.deps
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
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
    )
  }
}
