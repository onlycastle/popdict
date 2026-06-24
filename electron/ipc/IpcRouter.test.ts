/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { handlers, listeners } = vi.hoisted(() => ({
  handlers: new Map<string, any>(),
  listeners: new Map<string, any>(),
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: any) => handlers.set(channel, fn),
    on: (channel: string, fn: any) => listeners.set(channel, fn),
  },
}))

import { IpcRouter } from './IpcRouter'

beforeEach(() => {
  handlers.clear()
  listeners.clear()
})

describe('IpcRouter', () => {
  it('registers an invoke handler and returns its result', async () => {
    new IpcRouter().handle('ping', () => 'pong')
    expect(await handlers.get('ping')({})).toBe('pong')
  })

  it('logs and rethrows when an invoke handler fails', async () => {
    new IpcRouter().handle('boom', () => {
      throw new Error('kaboom')
    })
    await expect(handlers.get('boom')({})).rejects.toThrow('kaboom')
  })

  it('registers a send listener verbatim', () => {
    const cb = vi.fn()
    new IpcRouter().on('evt', cb)
    expect(listeners.get('evt')).toBe(cb)
  })

  it('returns this for chaining', () => {
    const router = new IpcRouter()
    expect(router.handle('a', () => 1)).toBe(router)
    expect(router.on('b', vi.fn())).toBe(router)
  })
})
