import { describe, expect, it } from 'vitest'
import { loginModalSubtitle, shouldShowSignInNudge, type SignInNudgeState } from './signInNudge'

const visible: SignInNudgeState = {
  configured: true,
  authLoading: false,
  signedIn: false,
  dismissedAt: null,
}

describe('shouldShowSignInNudge', () => {
  it('shows for a settled, signed-out, never-dismissed user', () => {
    expect(shouldShowSignInNudge(visible)).toBe(true)
  })
  it('hides while the auth session is still loading (no signed-in flash)', () => {
    expect(shouldShowSignInNudge({ ...visible, authLoading: true })).toBe(false)
  })
  it('hides when signed in', () => {
    expect(shouldShowSignInNudge({ ...visible, signedIn: true })).toBe(false)
  })
  it('hides when Supabase is not configured', () => {
    expect(shouldShowSignInNudge({ ...visible, configured: false })).toBe(false)
  })
  it('hides forever once dismissed', () => {
    expect(shouldShowSignInNudge({ ...visible, dismissedAt: 1752345600000 })).toBe(false)
  })
  it('hides while settings have not loaded yet (dismissedAt undefined)', () => {
    expect(shouldShowSignInNudge({ ...visible, dismissedAt: undefined })).toBe(false)
  })
})

describe('loginModalSubtitle', () => {
  it('names the pending word when there is one', () => {
    expect(loginModalSubtitle('serendipity')).toBe('Save “serendipity” to your account.')
  })
  it('falls back to the generic value pitch without a word', () => {
    expect(loginModalSubtitle('')).toBe('Save words you look up and review them weekly.')
    expect(loginModalSubtitle('   ')).toBe('Save words you look up and review them weekly.')
  })
})
