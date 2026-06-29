/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// loadRenderer reads this build-time global; provide it so open() takes the
// dev-server branch instead of throwing a ReferenceError.
vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', 'http://localhost:5173')

const { instances } = vi.hoisted(() => ({ instances: [] as any[] }))

vi.mock('electron', () => {
  class FakeWin {
    destroyed = false
    shown = false
    shownInactive = false
    focused = false
    position: [number, number] | null = null
    loadURL = vi.fn()
    loadFile = vi.fn()
    webContents = { send: vi.fn() }
    private closedHandlers: Array<() => void> = []
    constructor(public options: any) {
      instances.push(this)
    }
    on(event: string, cb: () => void) {
      if (event === 'closed') this.closedHandlers.push(cb)
    }
    isDestroyed() {
      return this.destroyed
    }
    focus() {
      this.focused = true
    }
    show() {
      this.shown = true
    }
    showInactive() {
      this.shown = true
      this.shownInactive = true
    }
    getBounds() {
      return { x: 0, y: 0, width: 800, height: 128 }
    }
    setPosition(x: number, y: number) {
      this.position = [x, y]
    }
    close() {
      this.destroyed = true
      this.closedHandlers.forEach((h) => h())
    }
  }
  const display = { workAreaSize: { width: 1440, height: 900 }, workArea: { x: 0, y: 0 } }
  return {
    BrowserWindow: FakeWin,
    screen: {
      getCursorScreenPoint: () => ({ x: 0, y: 0 }),
      getDisplayNearestPoint: () => display,
      getPrimaryDisplay: () => display,
    },
  }
})

import { WindowManager } from './WindowManager'
import type { WindowId, WindowSpec } from './windowSpecs'

const SPECS: Record<WindowId, WindowSpec> = {
  search: { hash: '', singleton: true, options: {} },
  settings: { hash: 'settings', singleton: true, options: {} },
  saved: { hash: 'saved', singleton: true, options: {} },
  onboarding: { hash: 'onboarding', singleton: true, options: {} },
}

function manager() {
  const wm = new WindowManager()
  wm.setSpecs(SPECS)
  return wm
}

beforeEach(() => {
  instances.length = 0
})

describe('WindowManager', () => {
  it('throws if open() is called before setSpecs', () => {
    expect(() => new WindowManager().open('search')).toThrow(/specs not configured/i)
  })

  it('creates and loads a window at its hash route', () => {
    manager().open('settings')
    expect(instances).toHaveLength(1)
    expect(instances[0].loadURL).toHaveBeenCalledWith('http://localhost:5173#/settings')
  })

  it('loads the search window with no hash', () => {
    manager().open('search')
    expect(instances[0].loadURL).toHaveBeenCalledWith('http://localhost:5173')
  })

  it('focuses the existing singleton instead of creating a second window', () => {
    const wm = manager()
    const first = wm.open('settings')
    const second = wm.open('settings')
    expect(second).toBe(first)
    expect(instances).toHaveLength(1)
    expect((first as any).focused).toBe(true)
  })

  it('get() returns null after the window is closed', () => {
    const wm = manager()
    const win = wm.open('settings') as any
    expect(wm.get('settings')).toBe(win)
    win.close()
    expect(wm.get('settings')).toBeNull()
  })

  it('re-creates a window after it was closed', () => {
    const wm = manager()
    ;(wm.open('settings') as any).close()
    wm.open('settings')
    expect(instances).toHaveLength(2)
  })

  it('showSearch positions, shows, focuses, and signals the search window', () => {
    const wm = manager()
    wm.open('search')
    wm.showSearch()
    const win = instances[0]
    expect(win.shown).toBe(true)
    expect(win.focused).toBe(true)
    expect(win.position).not.toBeNull()
    expect(win.webContents.send).toHaveBeenCalledWith('focus-search')
  })

  it('showSearch({ activate: false }) reveals the window without taking focus', () => {
    const wm = manager()
    wm.open('search')
    wm.showSearch({ activate: false })
    const win = instances[0]
    expect(win.shown).toBe(true)
    expect(win.shownInactive).toBe(true)
    expect(win.focused).toBe(false)
    expect(win.position).not.toBeNull()
    expect(win.webContents.send).not.toHaveBeenCalledWith('focus-search')
  })

  it('activateSearch focuses an already-visible search window', () => {
    const wm = manager()
    wm.open('search')
    wm.showSearch({ activate: false })
    wm.activateSearch()
    const win = instances[0]
    expect(win.focused).toBe(true)
    expect(win.webContents.send).toHaveBeenCalledWith('focus-search')
  })
})
