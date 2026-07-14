import { useEffect, useReducer, useState } from 'react'
import type { TargetLanguage, WordTranslation } from '../../shared/language'
import { translationService } from '../services/TranslationService'

export type TranslationState = {
  requestKey: string
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'
  translations: WordTranslation[]
}

export type TranslationAction =
  | { type: 'reset' }
  | { type: 'begin'; requestKey: string }
  | { type: 'resolve'; requestKey: string; translations: WordTranslation[] }
  | { type: 'fail'; requestKey: string }

export const INITIAL_TRANSLATION_STATE: TranslationState = {
  requestKey: '',
  status: 'idle',
  translations: [],
}

export function translationReducer(
  state: TranslationState,
  action: TranslationAction
): TranslationState {
  if (action.type === 'reset') return INITIAL_TRANSLATION_STATE
  if (action.type === 'begin') {
    return { requestKey: action.requestKey, status: 'loading', translations: [] }
  }
  if (action.requestKey !== state.requestKey) return state
  if (action.type === 'fail') return { ...state, status: 'error', translations: [] }
  return {
    requestKey: state.requestKey,
    status: action.translations.length > 0 ? 'ready' : 'empty',
    translations: action.translations,
  }
}

export function useTranslations(options: {
  word: string
  language: TargetLanguage | null
  enabled: boolean
}) {
  const { word, language, enabled } = options
  const [state, dispatch] = useReducer(translationReducer, INITIAL_TRANSLATION_STATE)
  const [retryToken, setRetryToken] = useState(0)
  const requestKey = enabled && word && language ? `${word}\u0000${language}` : ''

  useEffect(() => {
    if (!requestKey || !language) {
      dispatch({ type: 'reset' })
      return
    }

    let active = true
    dispatch({ type: 'begin', requestKey })
    void translationService.lookup(word, language).then(
      (translations) => {
        if (active) dispatch({ type: 'resolve', requestKey, translations })
      },
      () => {
        if (active) dispatch({ type: 'fail', requestKey })
      }
    )
    return () => {
      active = false
    }
  }, [language, requestKey, retryToken, word])

  return {
    ...state,
    retry: () => setRetryToken((token) => token + 1),
  }
}
