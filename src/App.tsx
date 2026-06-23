import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LoginModal from './components/LoginModal'
import SearchInput from './components/SearchInput'
import SearchResults from './components/SearchResults'
import { useDictionarySearch } from './hooks/useDictionarySearch'
import { useSupabaseAuth } from './hooks/useSupabaseAuth'
import { isWordSaved, saveWord } from './services/savedWords'
import Settings from './components/Settings'
import SavedWords from './components/SavedWords'
import Onboarding from './components/Onboarding'
import type { SearchResponse } from './types/dictionary'
import './App.css'

function getWordToSave(response: SearchResponse | null, fallback: string): string {
  return (
    response?.dictionaryResults?.[0]?.word ??
    response?.idiomResult?.term ??
    fallback
  ).trim()
}

function App() {
  // Settings opens as a separate window at #/settings. This check MUST stay
  // above every hook below: a window's hash is constant for its lifetime, so
  // the search hooks run for the search window and never for the settings
  // window, keeping hook order stable (React's Rules of Hooks).
  if (window.location.hash === '#/settings') {
    return <Settings />
  }

  if (window.location.hash === '#/saved') {
    return <SavedWords />
  }

  if (window.location.hash === '#/onboarding') {
    return <Onboarding />
  }

  const [query, setQuery] = useState('')
  const { response, loading, error, triggerSearch, searchedTerm } = useDictionarySearch(query)
  const auth = useSupabaseAuth()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [history, setHistory] = useState<string[]>([])
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [pendingSaveWord, setPendingSaveWord] = useState('')
  const [saveError, setSaveError] = useState('')
  const [savedWord, setSavedWord] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.electronAPI?.getHistory().then(setHistory)
  }, [])

  // Record the term that produced the current result (not the live query,
  // which runs ahead of the debounced search).
  useEffect(() => {
    if (response && !error && searchedTerm) {
      window.electronAPI?.addHistory(searchedTerm).then(setHistory)
    }
  }, [response, error, searchedTerm])

  // Focus search input when window is shown
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onFocusSearch(() => {
        searchInputRef.current?.focus()
      })
    }
  }, [])

  // Seed the search box when another window asks to look up a word
  // (e.g. clicking an entry in the Saved Words window).
  useEffect(() => {
    const off = window.electronAPI?.onSeedSearch?.((word) => {
      setQuery(word)
      searchInputRef.current?.focus()
    })
    return off
  }, [])

  // Handle ESC key to hide window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (loginPromptOpen) {
          setLoginPromptOpen(false)
          return
        }
        if (window.electronAPI) {
          window.electronAPI.hideWindow()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loginPromptOpen])

  const saveCurrentWord = useCallback(async (word: string) => {
    if (!auth.user || !response) return

    setSaving(true)
    setSaveError('')

    try {
      await saveWord({ source: response.source, user: auth.user, word })
      setSavedWord(word)
      setPendingSaveWord('')
      setLoginPromptOpen(false)
    } catch (saveWordError) {
      setSaveError(saveWordError instanceof Error ? saveWordError.message : 'Could not save word')
      setPendingSaveWord('')
    } finally {
      setSaving(false)
    }
  }, [auth.user, response])

  const handleSaveClick = useCallback(() => {
    const word = getWordToSave(response, searchedTerm || query)
    if (!word) return

    setSaveError('')

    if (!auth.user) {
      setPendingSaveWord(word)
      setLoginPromptOpen(true)
      return
    }

    void saveCurrentWord(word)
  }, [auth.user, query, response, saveCurrentWord, searchedTerm])

  useEffect(() => {
    if (auth.user && pendingSaveWord && !saving) {
      void saveCurrentWord(pendingSaveWord)
    }
  }, [auth.user, pendingSaveWord, saveCurrentWord, saving])

  // Dynamically adjust window height based on content
  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.setWindowHeight) return
    if (loginPromptOpen) {
      window.electronAPI.setWindowHeight(400)
    } else if ((query && (response || loading)) || (!query && history.length > 0)) {
      window.electronAPI.setWindowHeight(query ? 420 : 240)
    } else {
      window.electronAPI.setWindowHeight(80)
    }
  }, [history, loading, loginPromptOpen, query, response])

  const wordToSave = getWordToSave(response, searchedTerm || query)
  const alreadySaved =
    !!wordToSave && savedWord.toLowerCase() === wordToSave.toLowerCase()
  const saveLabel =
    saving && pendingSaveWord === wordToSave ? 'Saving' : alreadySaved ? 'Saved' : 'Save'

  useEffect(() => {
    setSaveError('')
  }, [wordToSave])

  // Durable "Saved" state: reflect words saved in any prior session, not just
  // the current one. Re-checks Supabase whenever the displayed word changes.
  useEffect(() => {
    if (!auth.user || !wordToSave) return
    let cancelled = false
    isWordSaved(auth.user, wordToSave)
      .then((saved) => {
        if (!cancelled) setSavedWord(saved ? wordToSave : '')
      })
      .catch(() => {
        // network/permission issue — leave save enabled
      })
    return () => {
      cancelled = true
    }
  }, [auth.user, wordToSave])

  return (
    <div className="app-container">
      <motion.div
        className="glass-window"
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <SearchInput
          ref={searchInputRef}
          value={query}
          onChange={setQuery}
          onSearch={triggerSearch}
          loading={loading}
        />

        <AnimatePresence mode="wait">
          {query && (
            <SearchResults
              response={response}
              loading={loading}
              error={error}
              query={query}
              onSave={response && !loading && !error ? handleSaveClick : undefined}
              saveDisabled={saving || alreadySaved}
              saveFeedback={
                saveError || (savedWord.toLowerCase() === wordToSave.toLowerCase() ? 'Saved' : '')
              }
              saveFeedbackTone={saveError ? 'error' : 'success'}
              saveLabel={saveLabel}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!query && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="empty-state"
            >
              {history.length > 0 ? (
                <div className="recent-list">
                  <p className="text-white/50 text-xs mb-2">Recent</p>
                  {history.map((word) => (
                    <button
                      key={word}
                      onClick={() => setQuery(word)}
                      className="block w-full text-left text-white/80 text-sm py-1 hover:text-white"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-white/80 text-sm">Start typing to search dictionary...</p>
                  <p className="text-white/70 text-xs mt-2">Press ESC to close</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <LoginModal
          configured={auth.configured}
          error={auth.error || saveError}
          loading={auth.loading || saving}
          message={auth.message}
          onClose={() => setLoginPromptOpen(false)}
          onSignIn={auth.signInWithGoogle}
          open={loginPromptOpen}
          word={pendingSaveWord || wordToSave}
        />
      </motion.div>
    </div>
  )
}

export default App
