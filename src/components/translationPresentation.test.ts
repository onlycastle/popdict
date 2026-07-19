import { describe, expect, it } from 'vitest'
import { translationPanelState } from './translationPresentation'

const base = {
  language: 'ko' as const,
  canonicalWord: 'bank',
  lookupStatus: 'ready' as const,
}

describe('translationPanelState', () => {
  it('shows translations identically for signed-out lookups', () => {
    expect(translationPanelState(base)).toBe('ready')
  })

  it('falls back silently when the dataset has no rows', () => {
    expect(translationPanelState({ ...base, lookupStatus: 'empty' })).toBe('hidden')
  })

  it('surfaces retryable errors without replacing the English result', () => {
    expect(translationPanelState({ ...base, lookupStatus: 'error' })).toBe('error')
  })

  it('never shows when there is no canonical single word', () => {
    expect(translationPanelState({ ...base, canonicalWord: null })).toBe('hidden')
  })
})
