import { describe, expect, it } from 'vitest'
import { shouldPromptQuizOptIn, translationIsSettledForSave } from './useSaveWord'

describe('shouldPromptQuizOptIn', () => {
  it('prompts exactly at the 5th save when no preference row exists', () => {
    expect(shouldPromptQuizOptIn(5, false)).toBe(true)
  })
  it.each([
    [4, false], // too early
    [6, false], // window passed — never nag late
    [5, true],  // user already decided (either way)
  ])('does not prompt for count=%i hasPrefs=%s', (count, hasPrefs) => {
    expect(shouldPromptQuizOptIn(count, hasPrefs)).toBe(false)
  })
})

describe('translationIsSettledForSave', () => {
  it('blocks a selected-language save until lookup settles', () => {
    expect(translationIsSettledForSave('es', 'idle')).toBe(false)
    expect(translationIsSettledForSave('es', 'loading')).toBe(false)
    expect(translationIsSettledForSave('es', 'ready')).toBe(true)
    expect(translationIsSettledForSave('es', 'empty')).toBe(true)
    expect(translationIsSettledForSave('es', 'error')).toBe(true)
    expect(translationIsSettledForSave(null, 'idle')).toBe(true)
  })
})
