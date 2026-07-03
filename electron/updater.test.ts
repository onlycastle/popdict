import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: () => '1.1.2',
  },
  autoUpdater: {
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
  },
}))

import { UpdateManager, type AutoUpdaterLike } from './updater'

type Listener = (...args: unknown[]) => void

function fakeAutoUpdater() {
  const listeners = new Map<string, Listener[]>()
  return {
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
    on(event: string, listener: Listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener])
      return this
    },
    emit(event: string, ...args: unknown[]) {
      for (const fn of listeners.get(event) ?? []) fn(...args)
    },
  } satisfies AutoUpdaterLike & { emit: (event: string, ...args: unknown[]) => void }
}

function makeManager(overrides: Partial<ConstructorParameters<typeof UpdateManager>[0]> = {}) {
  const updater = fakeAutoUpdater()
  const onUpdateReady = vi.fn()
  const onManualCheckResult = vi.fn()
  const manager = new UpdateManager({
    updater,
    isPackaged: true,
    platform: 'darwin',
    arch: 'arm64',
    version: '1.1.2',
    repo: 'onlycastle/popdict',
    onUpdateReady,
    onManualCheckResult,
    ...overrides,
  })
  return { manager, updater, onUpdateReady, onManualCheckResult }
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('UpdateManager.init', () => {
  it('is disabled in dev builds', () => {
    const { manager, updater } = makeManager({ isPackaged: false })
    expect(manager.init()).toBe(false)
    expect(updater.setFeedURL).not.toHaveBeenCalled()
  })

  it('is disabled off macOS', () => {
    const { manager } = makeManager({ platform: 'win32' })
    expect(manager.init()).toBe(false)
  })

  it('is disabled without a configured repo', () => {
    const { manager } = makeManager({ repo: '' })
    expect(manager.init()).toBe(false)
  })

  it('sets the update.electronjs.org feed URL and checks immediately', () => {
    const { manager, updater } = makeManager()
    expect(manager.init()).toBe(true)
    expect(updater.setFeedURL).toHaveBeenCalledWith({
      url: 'https://update.electronjs.org/onlycastle/popdict/darwin-arm64/1.1.2',
    })
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('checks again on the configured interval', () => {
    vi.useFakeTimers()
    const { manager, updater } = makeManager({ intervalMs: 1000 })
    manager.init()
    vi.advanceTimersByTime(3000)
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(4) // 1 initial + 3 ticks
  })

  it('returns false when setFeedURL throws', () => {
    const { manager, updater } = makeManager()
    updater.setFeedURL.mockImplementation(() => {
      throw new Error('bad url')
    })
    expect(manager.init()).toBe(false)
  })
})

describe('update-downloaded', () => {
  it('records the version (v-prefix stripped) and fires onUpdateReady', () => {
    const { manager, updater, onUpdateReady } = makeManager()
    manager.init()
    updater.emit('update-downloaded', null, 'notes', 'v1.2.0')
    expect(manager.updateReadyVersion).toBe('1.2.0')
    expect(onUpdateReady).toHaveBeenCalledWith('1.2.0', { manual: false })
  })

  it('tolerates a missing release name', () => {
    const { manager, updater, onUpdateReady } = makeManager()
    manager.init()
    updater.emit('update-downloaded', null, null, undefined)
    expect(manager.updateReadyVersion).toBe('')
    expect(onUpdateReady).toHaveBeenCalledWith('', { manual: false })
  })

  it('reports manual:true when the download lands during a manual check, and resets the pending flag', () => {
    const { manager, updater, onUpdateReady, onManualCheckResult } = makeManager()
    manager.init()
    manager.checkNow()
    updater.emit('update-downloaded', null, null, 'v1.2.0')
    expect(onUpdateReady).toHaveBeenCalledWith('1.2.0', { manual: true })
    // the download answered the manual check — a later background outcome is not misattributed
    updater.emit('update-not-available')
    expect(onManualCheckResult).not.toHaveBeenCalled()
  })
})

describe('manual vs background check outcomes', () => {
  it('background update-not-available stays silent', () => {
    const { manager, updater, onManualCheckResult } = makeManager()
    manager.init()
    updater.emit('update-not-available')
    expect(onManualCheckResult).not.toHaveBeenCalled()
  })

  it('background error stays silent (console only)', () => {
    const { manager, updater, onManualCheckResult } = makeManager()
    manager.init()
    updater.emit('error', new Error('offline'))
    expect(onManualCheckResult).not.toHaveBeenCalled()
  })

  it('manual check routes update-not-available to the hook, once', () => {
    const { manager, updater, onManualCheckResult } = makeManager()
    manager.init()
    manager.checkNow()
    updater.emit('update-not-available')
    updater.emit('update-not-available') // later background outcome
    expect(onManualCheckResult).toHaveBeenCalledTimes(1)
    expect(onManualCheckResult).toHaveBeenCalledWith('up-to-date')
  })

  it('manual check routes an error to the hook', () => {
    const { manager, updater, onManualCheckResult } = makeManager()
    manager.init()
    manager.checkNow()
    updater.emit('error', new Error('dns'))
    expect(onManualCheckResult).toHaveBeenCalledWith('error')
  })

  it('manual check triggers a checkForUpdates call', () => {
    const { manager, updater } = makeManager()
    manager.init()
    updater.checkForUpdates.mockClear()
    manager.checkNow()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('manual check reports an error when checkForUpdates throws synchronously', () => {
    const { manager, updater, onManualCheckResult } = makeManager()
    manager.init()
    updater.checkForUpdates.mockImplementation(() => {
      throw new Error('boom')
    })
    manager.checkNow()
    expect(onManualCheckResult).toHaveBeenCalledWith('error')
    // and a later background event is NOT misattributed to the manual check
    onManualCheckResult.mockClear()
    updater.emit('update-not-available')
    expect(onManualCheckResult).not.toHaveBeenCalled()
  })

  it('manual check with an update already staged re-fires onUpdateReady (manual) instead of re-checking', () => {
    const { manager, updater, onUpdateReady } = makeManager()
    manager.init()
    updater.emit('update-downloaded', null, null, 'v1.2.0')
    updater.checkForUpdates.mockClear()
    onUpdateReady.mockClear()
    manager.checkNow()
    expect(onUpdateReady).toHaveBeenCalledWith('1.2.0', { manual: true })
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('manual check on a disabled manager reports an error', () => {
    const { manager, onManualCheckResult } = makeManager({ isPackaged: false })
    manager.init()
    manager.checkNow()
    expect(onManualCheckResult).toHaveBeenCalledWith('error')
  })
})

describe('installUpdate', () => {
  it('delegates to quitAndInstall', () => {
    const { manager, updater } = makeManager()
    manager.init()
    manager.installUpdate()
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1)
  })
})
