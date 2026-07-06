import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { savedWords } from '../services/SavedWordsRepository'
import { quizPreferences } from '../services/QuizPreferencesRepository'
import type { SearchResponse } from '../types/dictionary'

/** The word a Save action targets: the canonical headword, else the raw query. */
export function getWordToSave(response: SearchResponse | null, fallback: string): string {
  return (response?.dictionaryResults?.[0]?.word ?? response?.idiomResult?.term ?? fallback).trim()
}

/** Prompt exactly once, at the 5th save, unless the user already has a preference row. */
export function shouldPromptQuizOptIn(count: number, hasPreferences: boolean): boolean {
  return count === 5 && !hasPreferences
}

interface UseSaveWordArgs {
  user: User | null
  response: SearchResponse | null
  searchedTerm: string
  query: string
}

/**
 * Owns the save / sign-in-to-save orchestration: persisting a word, prompting
 * login when signed out, auto-saving once signed in, and surfacing durable
 * "Saved" state across sessions. Extracted from App so the view only renders.
 */
export function useSaveWord({ user, response, searchedTerm, query }: UseSaveWordArgs) {
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [pendingSaveWord, setPendingSaveWord] = useState('')
  const [saveError, setSaveError] = useState('')
  const [savedWord, setSavedWord] = useState('')
  const [saving, setSaving] = useState(false)
  const [quizPromptOpen, setQuizPromptOpen] = useState(false)

  const maybePromptQuizOptIn = useCallback(async (u: User) => {
    try {
      const [count, prefs] = await Promise.all([savedWords.count(u), quizPreferences.get(u)])
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

  const saveCurrentWord = useCallback(
    async (word: string) => {
      if (!user || !response) return
      const savingUser = user

      setSaving(true)
      setSaveError('')

      try {
        await savedWords.save({ source: response.source, user: savingUser, word })
        setSavedWord(word)
        setPendingSaveWord('')
        setLoginPromptOpen(false)
        void maybePromptQuizOptIn(savingUser)
      } catch (saveWordError) {
        setSaveError(saveWordError instanceof Error ? saveWordError.message : 'Could not save word')
        setPendingSaveWord('')
      } finally {
        setSaving(false)
      }
    },
    [user, response, maybePromptQuizOptIn]
  )

  const handleSaveClick = useCallback(() => {
    const word = getWordToSave(response, searchedTerm || query)
    if (!word) return

    setSaveError('')

    if (!user) {
      setPendingSaveWord(word)
      setLoginPromptOpen(true)
      return
    }

    void saveCurrentWord(word)
  }, [user, query, response, saveCurrentWord, searchedTerm])

  // Finish a pending save once the user signs in.
  useEffect(() => {
    if (user && pendingSaveWord && !saving) {
      void saveCurrentWord(pendingSaveWord)
    }
  }, [user, pendingSaveWord, saveCurrentWord, saving])

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
    pendingSaveWord,
    savedWord,
    saveError,
    saving,
    alreadySaved,
    saveLabel,
    loginPromptOpen,
    setLoginPromptOpen,
    handleSaveClick,
    quizPromptOpen,
    setQuizPromptOpen,
    enableQuizEmails,
    dismissQuizPrompt,
  }
}
