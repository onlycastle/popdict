import { describe, expect, it } from 'vitest'
import {
  INITIAL_TRANSLATION_STATE,
  translationReducer,
  type TranslationState,
} from './useTranslations'

describe('translationReducer', () => {
  it('models loading, ready, empty, and retryable error states', () => {
    const loading = translationReducer(INITIAL_TRANSLATION_STATE, {
      type: 'begin', requestKey: 'bank\u0000es',
    })
    expect(loading.status).toBe('loading')
    expect(translationReducer(loading, {
      type: 'resolve', requestKey: 'bank\u0000es', translations: [],
    }).status).toBe('empty')
    expect(translationReducer(loading, {
      type: 'resolve', requestKey: 'bank\u0000es',
      translations: [{ text: 'banco', senseLabel: 'financial institution', rank: 1 }],
    })).toMatchObject({ status: 'ready', translations: [{ text: 'banco' }] })
    expect(translationReducer(loading, {
      type: 'fail', requestKey: 'bank\u0000es',
    }).status).toBe('error')
  })

  it('ignores a stale response from an earlier lookup', () => {
    const current: TranslationState = {
      requestKey: 'bus\u0000pt-BR', status: 'loading', translations: [],
    }
    const stale = translationReducer(current, {
      type: 'resolve', requestKey: 'bank\u0000es',
      translations: [{ text: 'banco', senseLabel: null, rank: 1 }],
    })
    expect(stale).toBe(current)
  })
})
