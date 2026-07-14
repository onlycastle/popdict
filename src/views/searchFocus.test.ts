import { describe, expect, it, vi } from 'vitest'
import { handleSearchWindowFocus } from './searchFocus'

describe('handleSearchWindowFocus', () => {
  it('refreshes persisted settings and restores input focus', () => {
    const refresh = vi.fn()
    const focus = vi.fn()
    handleSearchWindowFocus(refresh, focus)
    expect(refresh).toHaveBeenCalledOnce()
    expect(focus).toHaveBeenCalledOnce()
  })
})
