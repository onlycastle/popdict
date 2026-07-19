import { describe, expect, it } from 'vitest'
import {
  prepareSaveIntent,
  shouldPromptQuizOptIn,
  translationIsSettledForSave,
} from './useSaveWord'
import type { SearchResponse } from '../types/dictionary'

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

  it('does not wait for translations when the result is not translation-eligible', () => {
    expect(translationIsSettledForSave('es', 'idle', false)).toBe(true)
  })
})

describe('prepareSaveIntent', () => {
  const response: SearchResponse = {
    source: 'free-dictionary',
    provenance: 'live',
    dictionaryResults: [{
      word: 'bank',
      meanings: [{
        partOfSpeech: 'noun',
        definitions: [{ definition: 'A financial institution.' }],
      }],
    }],
  }

  it('captures the displayed lookup and translation as an immutable auth-pending intent', () => {
    const intent = prepareSaveIntent({
      response,
      fallback: 'bank',
      translationLanguage: 'es',
      translationStatus: 'ready',
      translationRequired: true,
      translations: [{ text: 'banco', rank: 1, senseLabel: null }],
    })

    expect(intent).toMatchObject({
      word: 'bank',
      source: 'free-dictionary',
      details: {
        definition: 'A financial institution.',
        translation: 'banco',
        translationLanguage: 'es',
      },
    })
  })

  it('allows an English-only phrase save while translation lookup is idle', () => {
    const phraseResponse: SearchResponse = {
      ...response,
      source: 'kaikki-phrases',
      dictionaryResults: [{
        word: 'break a leg',
        meanings: [{
          partOfSpeech: 'phrase',
          definitions: [{ definition: 'A wish for good luck.' }],
        }],
      }],
    }
    expect(prepareSaveIntent({
      response: phraseResponse,
      fallback: 'break a leg',
      translationLanguage: 'es',
      translationStatus: 'idle',
      translationRequired: false,
      translations: [],
    })).toMatchObject({
      word: 'break a leg',
      details: { translation: null, translationLanguage: null },
    })
  })
})
