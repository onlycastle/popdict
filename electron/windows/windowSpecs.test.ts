/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// afterCreate reads this build-time global to decide whether to open DevTools.
// Stub it truthy to simulate `npm start` (dev), where DevTools is auto-opened.
vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', 'http://localhost:5173')

vi.mock('electron', () => {
  const display = { workAreaSize: { width: 1440, height: 900 }, workArea: { x: 0, y: 0 } }
  return {
    screen: { getPrimaryDisplay: () => display },
  }
})

import { buildWindowSpecs } from './windowSpecs'

/**
 * A minimal BrowserWindow stand-in that records the handlers afterCreate wires
 * up, so a test can fire 'blur' and assert whether the window hid itself.
 * `devToolsFocused` models the user clicking into the detached DevTools panel.
 */
function fakeSearchWin() {
  const handlers: Record<string, () => void> = {}
  const win: any = {
    destroyed: false,
    hide: vi.fn(),
    isDestroyed() {
      return win.destroyed
    },
    setVisibleOnAllWorkspaces: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    getBounds: () => ({ x: 0, y: 0, width: 800, height: 128 }),
    setPosition: vi.fn(),
    on(event: string, cb: () => void) {
      handlers[event] = cb
    },
    webContents: {
      _devToolsFocused: false,
      openDevTools: vi.fn(),
      once: vi.fn(),
      on: vi.fn(),
      // In dev the search window's DevTools is open for the whole session...
      isDevToolsOpened: vi.fn(() => true),
      // ...but only focused while the user is actually clicking inside it.
      isDevToolsFocused: vi.fn(() => win.webContents._devToolsFocused),
    },
  }
  return { win, blur: () => handlers['blur']?.() }
}

function wireSearchWindow(win: any) {
  const specs = buildWindowSpecs(vi.fn())
  specs.search.afterCreate!(win)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('search window blur hide behavior', () => {
  it('hides when focus is lost to another app / the desktop (click-outside)', () => {
    const { win, blur } = fakeSearchWin()
    wireSearchWindow(win)

    win.webContents._devToolsFocused = false // focus went elsewhere, not DevTools
    blur()

    expect(win.hide).toHaveBeenCalledTimes(1)
  })

  it('stays visible when focus goes to its own DevTools (so it can be inspected)', () => {
    const { win, blur } = fakeSearchWin()
    wireSearchWindow(win)

    win.webContents._devToolsFocused = true
    blur()

    expect(win.hide).not.toHaveBeenCalled()
  })

  it('does not touch a destroyed window on blur', () => {
    const { win, blur } = fakeSearchWin()
    wireSearchWindow(win)

    win.destroyed = true
    blur()

    expect(win.hide).not.toHaveBeenCalled()
  })
})
