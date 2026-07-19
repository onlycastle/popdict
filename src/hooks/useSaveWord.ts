import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { savedWords } from '../services/SavedWordsRepository'
import { quizPreferences } from '../services/QuizPreferencesRepository'
import { productAnalytics } from '../services/ProductAnalytics'
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
  user: User | null
  response: SearchResponse | null
  searchedTerm: string
  query: string
  translationLanguage: TargetLanguage | null
  translationStatus: TranslationStatus
  translationRequired: boolean
  translations: WordTranslation[]
}

/**
 * Owns the save / sign-in-to-save orchestration: persisting a word, prompting
 * login when signed out, auto-saving once signed in, and surfacing durable
 * "Saved" state across sessions. Extracted from App so the view only renders.
 */
export function useSaveWord({
  user,
  response,
  searchedTerm,
  query,
  translationLanguage,
  translationStatus,
  translationRequired,
  translations,
}: UseSaveWordArgs) {
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [pendingSave, setPendingSave] = useState<PreparedSaveIntent | null>(null)
  const [saveError, setSaveError] = useState('')
  const [savedWord, setSavedWord] = useState('')
  const [saving, setSaving] = useState(false)
  const [quizPromptOpen, setQuizPromptOpen] = useState(false)

  const maybePromptQuizOptIn = useCallback(async (u: User) => {
    try {
      const [count, prefs] = await Promise.all([savedWords.count(u), quizPreferences.get(u)])
      if (count === 1) void productAnalytics.track('first_word_saved')
      if (shouldPromptQuizOptIn(count, prefs !== null)) setQuizPromptOpen(true)
    } catch {
      // best-effort — never block or fail a save over the prompt
    }
  }, [])

  const enableQuizEmails = useCallback(async () => {
    setQuizPromptOpen(false)
    if (!user) return
    try {
      await quizPreferences.setEnabled(user, true)
    } catch {
      // best-effort — a failed write can be redone from Settings; never blocks UI
    }
  }, [user])

  // Persist a decline as an enabled=false row so the prompt never re-nags —
  // e.g. re-saving an existing word while the count is still exactly 5.
  const dismissQuizPrompt = useCallback(async () => {
    setQuizPromptOpen(false)
    if (!user) return
    try {
      await quizPreferences.setEnabled(user, false)
    } catch {
      // best-effort — a failed write may re-show the prompt later, never blocks UI
    }
  }, [user])

  const wordToSave = getWordToSave(response, searchedTerm || query)

  const savePreparedIntent = useCallback(
    async (intent: PreparedSaveIntent, completesPendingAuth = false) => {
      if (!user) return
      const savingUser = user

      setSaving(true)
      setSaveError('')

      try {
        await savedWords.save({ ...intent, user: savingUser })
        if (completesPendingAuth) void productAnalytics.track('pending_save_completed')
        setSavedWord(intent.word)
        setPendingSave(null)
        setLoginPromptOpen(false)
        void maybePromptQuizOptIn(savingUser)
      } catch (saveWordError) {
        setSaveError(saveWordError instanceof Error ? saveWordError.message : 'Could not save word')
        setPendingSave(null)
      } finally {
        setSaving(false)
      }
    },
    [user, maybePromptQuizOptIn]
  )

  const handleSaveClick = useCallback(() => {
    const intent = prepareSaveIntent({
      response,
      fallback: searchedTerm || query,
      translationLanguage,
      translationStatus,
      translationRequired,
      translations,
    })
    if (!intent) return

    setSaveError('')

    if (!user) {
      void productAnalytics.track('save_intent_signed_out')
      setPendingSave(intent)
      setLoginPromptOpen(true)
      return
    }

    void savePreparedIntent(intent)
  }, [
    user,
    query,
    response,
    savePreparedIntent,
    searchedTerm,
    translationLanguage,
    translationRequired,
    translationStatus,
    translations,
  ])

  // Finish a pending save once the user signs in.
  useEffect(() => {
    if (user && pendingSave && !saving) {
      void savePreparedIntent(pendingSave, true)
    }
  }, [user, pendingSave, savePreparedIntent, saving])

  const openLoginPrompt = useCallback(() => setLoginPromptOpen(true), [])
  const dismissLoginPrompt = useCallback(() => {
    setPendingSave(null)
    setLoginPromptOpen(false)
  }, [])

  // Clear any save error when the target word changes.
  useEffect(() => {
    setSaveError('')
  }, [wordToSave])

  // Durable "Saved" state: reflect words saved in any prior session, not just
  // the current one. Re-checks Supabase whenever the displayed word changes.
  useEffect(() => {
    if (!user || !wordToSave) return
    let cancelled = false
    savedWords
      .isSaved(user, wordToSave)
      .then((saved) => {
        if (!cancelled) setSavedWord(saved ? wordToSave : '')
      })
      .catch(() => {
        // network/permission issue — leave save enabled
      })
    return () => {
      cancelled = true
    }
  }, [user, wordToSave])

  const alreadySaved = !!wordToSave && savedWord.toLowerCase() === wordToSave.toLowerCase()
  const saveLabel = saving ? 'Saving' : alreadySaved ? 'Saved' : 'Save'

  return {
    wordToSave,
    pendingSaveWord: pendingSave?.word ?? '',
    savedWord,
    saveError,
    saving,
    alreadySaved,
    saveLabel,
    loginPromptOpen,
    openLoginPrompt,
    dismissLoginPrompt,
    handleSaveClick,
    quizPromptOpen,
    setQuizPromptOpen,
    enableQuizEmails,
    dismissQuizPrompt,
  }
}
