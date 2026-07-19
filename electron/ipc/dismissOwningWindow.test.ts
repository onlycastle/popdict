import { describe, expect, it, vi } from 'vitest'
import { dismissOwningWindow } from './dismissOwningWindow'

function fakeWindow() {
  return { hide: vi.fn(), close: vi.fn() }
}

describe('dismissOwningWindow', () => {
  it('hides the persistent search window', () => {
    const sender = { id: 'search-web-contents' }
    const search = fakeWindow()
    dismissOwningWindow(sender, () => search, search)
    expect(search.hide).toHaveBeenCalledOnce()
    expect(search.close).not.toHaveBeenCalled()
  })

  it('closes a secondary review window so reopening starts a fresh session', () => {
    const sender = { id: 'review-web-contents' }
    const search = fakeWindow()
    const review = fakeWindow()
    dismissOwningWindow(sender, () => review, search)
    expect(review.close).toHaveBeenCalledOnce()
    expect(review.hide).not.toHaveBeenCalled()
  })

  it('does nothing when the sender no longer owns a window', () => {
    expect(() => dismissOwningWindow({}, () => null, fakeWindow())).not.toThrow()
  })
})
