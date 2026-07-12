import { describe, expect, it } from 'vitest'
import { shouldShowSignInNudge, SIGN_IN_NUDGE_THRESHOLD } from './signInNudge'

describe('shouldShowSignInNudge', () => {
  it('shows for a signed-out user at the threshold with no dismissal', () => {
    expect(
      shouldShowSignInNudge({ signedIn: false, lookupCount: SIGN_IN_NUDGE_THRESHOLD, dismissedAt: null })
    ).toBe(true)
  })
  it.each([
    ['below the threshold', { signedIn: false, lookupCount: SIGN_IN_NUDGE_THRESHOLD - 1, dismissedAt: null }],
    ['signed in', { signedIn: true, lookupCount: 50, dismissedAt: null }],
    ['dismissed', { signedIn: false, lookupCount: 50, dismissedAt: 1 }],
  ])('hides when %s', (_label, state) => {
    expect(shouldShowSignInNudge(state)).toBe(false)
  })
})
