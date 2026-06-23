/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// app.isReady() is read through a hoisted, mutable flag so individual tests can
// toggle "app ready" before the module under test is imported.
const { state } = vi.hoisted(() => ({ state: { ready: true } }))
vi.mock('electron', () => ({
  app: { isReady: () => state.ready },
  BrowserWindow: class {},
}))

import { AuthCallbackBroker } from './AuthCallbackBroker'

const CALLBACK = 'popdict://auth/callback?code=abc'
const log = { event: vi.fn() }

function fakeWindow(opts: { loading?: boolean } = {}) {
  return {
    webContents: {
      isDestroyed: () => false,
      isLoading: () => opts.loading ?? false,
      once: vi.fn(),
      send: vi.fn(),
    },
    isMinimized: () => false,
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
  } as any
}

const fakeWindows = (map: Record<string, any>) => ({ get: (id: string) => map[id] ?? null }) as any

beforeEach(() => {
  state.ready = true
  log.event.mockClear()
})

describe('AuthCallbackBroker', () => {
  it('ignores non-auth callback URLs', () => {
    const broker = new AuthCallbackBroker(fakeWindows({}), log)
    broker.receive('https://example.com/whatever')
    expect(broker.hasPending).toBe(false)
  })

  it('stores the callback but does not dispatch when the app is not ready', () => {
    state.ready = false
    const settings = fakeWindow()
    const broker = new AuthCallbackBroker(fakeWindows({ settings }), log)
    broker.receive(CALLBACK)
    expect(broker.hasPending).toBe(true)
    expect(settings.webContents.send).not.toHaveBeenCalled()
  })

  it('delivers the callback to the settings window when ready', () => {
    const settings = fakeWindow()
    const broker = new AuthCallbackBroker(fakeWindows({ settings }), log)
    broker.receive(CALLBACK)
    expect(settings.webContents.send).toHaveBeenCalledWith('auth-callback', CALLBACK)
    expect(settings.show).toHaveBeenCalled()
    expect(settings.focus).toHaveBeenCalled()
  })

  it('falls back to the search window when no settings window exists', () => {
    const search = fakeWindow()
    const broker = new AuthCallbackBroker(fakeWindows({ search }), log)
    broker.receive(CALLBACK)
    expect(search.webContents.send).toHaveBeenCalledWith('auth-callback', CALLBACK)
  })

  it('prefers an explicit target window over settings/search', () => {
    const settings = fakeWindow()
    const target = fakeWindow()
    const broker = new AuthCallbackBroker(fakeWindows({ settings }), log)
    broker.setTarget(target)
    broker.receive(CALLBACK)
    expect(target.webContents.send).toHaveBeenCalled()
    expect(settings.webContents.send).not.toHaveBeenCalled()
  })

  it('does not deliver the same callback twice', () => {
    const settings = fakeWindow()
    const broker = new AuthCallbackBroker(fakeWindows({ settings }), log)
    broker.receive(CALLBACK)
    broker.dispatch()
    expect(settings.webContents.send).toHaveBeenCalledTimes(1)
  })

  it('waits for did-finish-load when the target is still loading', () => {
    const settings = fakeWindow({ loading: true })
    const broker = new AuthCallbackBroker(fakeWindows({ settings }), log)
    broker.receive(CALLBACK)
    expect(settings.webContents.send).not.toHaveBeenCalled()
    expect(settings.webContents.once).toHaveBeenCalledWith('did-finish-load', expect.any(Function))
  })

  it('consume() returns and clears the pending callback', () => {
    const settings = fakeWindow({ loading: true })
    const broker = new AuthCallbackBroker(fakeWindows({ settings }), log)
    broker.receive(CALLBACK)
    expect(broker.consume()).toBe(CALLBACK)
    expect(broker.hasPending).toBe(false)
    expect(broker.consume()).toBeNull()
  })
})
