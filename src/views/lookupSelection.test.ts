import { describe, expect, it, vi } from 'vitest'
import { handleLookupSelection } from './lookupSelection'

describe('handleLookupSelection', () => {
  it.each([
    ['recovery' as const, 1],
    ['related' as const, 0],
  ])('tracks only %s selections as recovery usage', (kind, expectedTracks) => {
    const setQuery = vi.fn()
    const focusSearch = vi.fn()
    const trackRecovery = vi.fn()

    handleLookupSelection(kind, 'lender', { setQuery, focusSearch, trackRecovery })

    expect(setQuery).toHaveBeenCalledWith('lender')
    expect(focusSearch).toHaveBeenCalledOnce()
    expect(trackRecovery).toHaveBeenCalledTimes(expectedTracks)
  })
})
