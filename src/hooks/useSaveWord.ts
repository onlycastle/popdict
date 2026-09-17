import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { savedWords } from '../services/SavedWordsRepository'
import { LOCAL_OWNER } from '../services/LocalSavedWordsRepository'
import type { SearchResponse } from '../types/dictionary'
import type { SavedWordDetails } from '../types/savedWords'
import type { TargetLanguage, WordTranslation } from '../../shared/language'
import { savedWordDetailsFromLookup } from '../services/savedWordDetails'

/** The word a Save action targets: the canonical headword, else the raw query. */
export function getWordToSave(response: SearchResponse | null, fallback: string): string {
  return (response?.dictionaryResults?.[0]?.word ?? fallback).trim()
}

/** Prompt exactly once, at the 5th save, unless the user already has a preference row. */
export function shouldPromptQuizOptIn(count: number, hasPreferences: boolean): boolean {
  return count === 5 && !hasPreferences
}

type TranslationStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

export function translationIsSettledForSave(
  language: TargetLanguage | null,
  status: TranslationStatus,
  translationRequired = true,
): boolean {
  return !translationRequired || language === null || (status !== 'idle' && status !== 'loading')
}

export type PreparedSaveIntent = {
  word: string
  source: SearchResponse['source']
  details: SavedWordDetails | null
}

/** Capture the exact displayed lookup before auth or navigation can change it. */
export function prepareSaveIntent(input: {
  response: SearchResponse | null
  fallback: string
  translationLanguage: TargetLanguage | null
  translationStatus: TranslationStatus
  translationRequired: boolean
  translations: WordTranslation[]
}): PreparedSaveIntent | null {
  if (!input.response) return null
  const word = getWordToSave(input.response, input.fallback)
  if (!word || !translationIsSettledForSave(
    input.translationLanguage,
    input.translationStatus,
    input.translationRequired,
  )) return null

  return {
    word,
    source: input.response.source,
    details: savedWordDetailsFromLookup({
      response: input.response,
      language: input.translationLanguage,
      translations: input.translations,
      translationComplete: input.translationRequired && (
        input.translationStatus === 'ready' || input.translationStatus === 'empty'
      ),
    }),
  }
}

interface UseSaveWordArgs {
  user?: User | null
  response: SearchResponse | null
  searchedTerm: string
  query: string
  translationLanguage: TargetLanguage | null
  translationStatus: TranslationStatus
  translationRequired: boolean
  translations: WordTranslation[]
}

/** Saves directly to the device library, with no authentication dependency. */
export function useSaveWord({ response, searchedTerm, query, translationLanguage,
  translationStatus, translationRequired, translations }: UseSaveWordArgs) {
  const [saveError, setSaveError] = useState('')
  const [savedWord, setSavedWord] = useState('')
  const [saving, setSaving] = useState(false)
  const wordToSave = getWordToSave(response, searchedTerm || query)
  const handleSaveClick = useCallback(async () => {
    if (saving) return
    const intent = prepareSaveIntent({ response, fallback: searchedTerm || query,
      translationLanguage, translationStatus, translationRequired, translations })
    if (!intent) return
    setSaving(true)
    setSaveError('')
    try {
      await savedWords.save(intent)
      setSavedWord(intent.word)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save word on this Mac.')
    } finally { setSaving(false) }
  }, [saving, response, searchedTerm, query, translationLanguage, translationStatus, translationRequired, translations])
  useEffect(() => {
    let active = true
    setSaveError('')
    setSavedWord('')
    if (wordToSave) void savedWords.isSaved(LOCAL_OWNER, wordToSave).then((saved) => {
      if (active) setSavedWord(saved ? wordToSave : '')
    }).catch((): void => undefined)
    return () => { active = false }
  }, [wordToSave])
  const alreadySaved = !!wordToSave && savedWord.toLowerCase() === wordToSave.toLowerCase()
  return { wordToSave, savedWord, saveError, saving, alreadySaved,
    saveLabel: saving ? 'Saving' : alreadySaved ? 'Saved' : 'Save', handleSaveClick }
}
