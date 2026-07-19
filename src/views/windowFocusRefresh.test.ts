import { describe, expect, it, vi } from 'vitest'
import { subscribeWindowFocus } from './windowFocusRefresh'

describe('subscribeWindowFocus', () => {
  it('refreshes on focus and removes the same listener on cleanup', () => {
    let listener: (() => void) | null = null
    const target = {
      addEventListener: vi.fn((_type: 'focus', next: () => void) => { listener = next }),
      removeEventListener: vi.fn(),
    }
    const refresh = vi.fn()
    const unsubscribe = subscribeWindowFocus(target, refresh)
    ;(listener as (() => void) | null)?.()
    expect(refresh).toHaveBeenCalledOnce()
    unsubscribe()
    expect(target.removeEventListener).toHaveBeenCalledWith('focus', refresh)
  })
})
