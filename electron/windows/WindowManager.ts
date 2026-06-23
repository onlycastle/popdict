import { BrowserWindow, screen } from 'electron'
import * as path from 'path'
import { SEARCH_WINDOW_TOP_OFFSET, type WindowId, type WindowSpec } from './windowSpecs'

/**
 * Owns every app window: their references, creation, deduplication, and cleanup.
 * Replaces the four near-identical window factories and the module-level window
 * variables that used to live in main.ts.
 */
export class WindowManager {
  private windows = new Map<WindowId, BrowserWindow>()
  private specs: Record<WindowId, WindowSpec> | null = null

  /** Provide the window definitions. Must be called before open(). */
  setSpecs(specs: Record<WindowId, WindowSpec>): void {
    this.specs = specs
  }

  /** Open the window for `id`, or focus it if it's a singleton already open. */
  open(id: WindowId): BrowserWindow {
    if (!this.specs) throw new Error('WindowManager: specs not configured')
    const spec = this.specs[id]

    const existing = this.windows.get(id)
    if (existing && !existing.isDestroyed()) {
      if (spec.singleton) existing.focus()
      return existing
    }

    const win = new BrowserWindow(spec.options)
    this.windows.set(id, win)
    this.loadRenderer(win, spec.hash)
    win.on('closed', () => {
      if (this.windows.get(id) === win) this.windows.delete(id)
    })
    spec.afterCreate?.(win)
    return win
  }

  /** The live window for `id`, or null if it's absent or destroyed. */
  get(id: WindowId): BrowserWindow | null {
    const win = this.windows.get(id)
    return win && !win.isDestroyed() ? win : null
  }

  /** Position the search window on the active display, then show + focus it. */
  showSearch(): void {
    const win = this.get('search')
    if (!win) return
    const cursorPoint = screen.getCursorScreenPoint()
    const currentDisplay = screen.getDisplayNearestPoint(cursorPoint)
    const { width: screenWidth } = currentDisplay.workAreaSize
    const { x: displayX, y: displayY } = currentDisplay.workArea
    const bounds = win.getBounds()
    win.setPosition(
      displayX + Math.round((screenWidth - bounds.width) / 2),
      displayY + SEARCH_WINDOW_TOP_OFFSET
    )
    win.show()
    win.focus()
    win.webContents.send('focus-search')
  }

  /** Load the renderer at the spec's route — dev server in dev, packaged file otherwise. */
  private loadRenderer(win: BrowserWindow, hash: string): void {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      win.loadURL(
        hash ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/${hash}` : MAIN_WINDOW_VITE_DEV_SERVER_URL
      )
    } else {
      const indexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
      win.loadFile(indexPath, hash ? { hash } : undefined)
    }
  }
}
