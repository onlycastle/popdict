import { describe, it, expect, vi, beforeEach } from 'vitest'

const { gs } = vi.hoisted(() => ({
  gs: { register: vi.fn(), unregisterAll: vi.fn(), isRegistered: vi.fn() },
}))
vi.mock('electron', () => ({ globalShortcut: gs }))

import { HotkeyManager } from './HotkeyManager'

beforeEach(() => {
  gs.register.mockReset()
  gs.unregisterAll.mockReset()
  gs.isRegistered.mockReset()
})

describe('HotkeyManager', () => {
  it('clears prior shortcuts and reports success', () => {
    gs.register.mockReturnValue(true)
    gs.isRegistered.mockReturnValue(true)
    const trigger = vi.fn()

    const ok = new HotkeyManager(trigger).register('CommandOrControl+Shift+Space')

    expect(ok).toBe(true)
    expect(gs.unregisterAll).toHaveBeenCalled()
    expect(gs.register).toHaveBeenCalledWith('CommandOrControl+Shift+Space', trigger)
  })

  it('returns false when the OS does not confirm the registration', () => {
    gs.register.mockReturnValue(true)
    gs.isRegistered.mockReturnValue(false)
    expect(new HotkeyManager(vi.fn()).register('Bad+Combo')).toBe(false)
  })

  it('returns false when register throws', () => {
    gs.register.mockImplementation(() => {
      throw new Error('reserved')
    })
    expect(new HotkeyManager(vi.fn()).register('Y')).toBe(false)
  })

  it('unregisterAll delegates to globalShortcut', () => {
    new HotkeyManager(vi.fn()).unregisterAll()
    expect(gs.unregisterAll).toHaveBeenCalled()
  })
})
