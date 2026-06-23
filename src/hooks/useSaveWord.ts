import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { savedWords } from '../services/SavedWordsRepository'
import type { SearchResponse } from '../types/dictionary'

/** The word a Save action targets: the canonical headword, else the raw query. */
export function getWordToSave(response: SearchResponse | null, fallback: string): string {
  return (response?.dictionaryResults?.[0]?.word ?? response?.idiomResult?.term ?? fallback).trim()
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

  const wordToSave = getWordToSave(response, searchedTerm || query)

  const saveCurrentWord = useCallback(
    async (word: string) => {
      if (!user || !response) return

      setSaving(true)
      setSaveError('')

      try {
        await savedWords.save({ source: response.source, user, word })
        setSavedWord(word)
        setPendingSaveWord('')
        setLoginPromptOpen(false)
      } catch (saveWordError) {
        setSaveError(saveWordError instanceof Error ? saveWordError.message : 'Could not save word')
        setPendingSaveWord('')
      } finally {
        setSaving(false)
      }
    },
    [user, response]
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
  const saveLabel =
    saving && pendingSaveWord === wordToSave ? 'Saving' : alreadySaved ? 'Saved' : 'Save'

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
  }
}
