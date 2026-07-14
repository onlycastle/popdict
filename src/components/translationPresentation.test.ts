import { describe, expect, it } from 'vitest'
import { translationPanelState } from './translationPresentation'

const base = {
  language: 'ko' as const,
  canonicalWord: 'bank',
  authLoading: false,
  signedIn: true,
  lookupStatus: 'ready' as const,
}

describe('translationPanelState', () => {
  it('gates translations behind sign-in', () => {
    expect(translationPanelState({ ...base, signedIn: false })).toBe('gated')
  })

  it('falls back silently when the dataset has no rows', () => {
    expect(translationPanelState({ ...base, lookupStatus: 'empty' })).toBe('hidden')
  })

  it('surfaces retryable errors without replacing the English result', () => {
    expect(translationPanelState({ ...base, lookupStatus: 'error' })).toBe('error')
  })

  it('never shows for a phrase or while auth is unresolved', () => {
    expect(translationPanelState({ ...base, canonicalWord: null })).toBe('hidden')
    expect(translationPanelState({ ...base, authLoading: true })).toBe('hidden')
  })
})
