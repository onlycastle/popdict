import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import LoginModal from '../components/LoginModal'
import SearchInput from '../components/SearchInput'
import SearchResults from '../components/SearchResults'
import WindowControls from '../components/WindowControls'
import { useDictionarySearch } from '../hooks/useDictionarySearch'
import { useSupabaseAuth } from '../hooks/useSupabaseAuth'
import { useSaveWord } from '../hooks/useSaveWord'
import '../App.css'

export default function SearchView() {
  const [query, setQuery] = useState('')
  const { response, loading, error, triggerSearch, searchedTerm } = useDictionarySearch(query)
  const auth = useSupabaseAuth()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<string[]>([])

  const {
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
  } = useSaveWord({ user: auth.user, response, searchedTerm, query })

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
  }, [loginPromptOpen, setLoginPromptOpen])

  const handleRemoveRecent = useCallback((word: string) => {
    window.electronAPI?.removeHistory(word).then(setHistory)
  }, [])

  // Dynamically adjust window height based on content
  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.setWindowHeight) return
    // Heights include the ~36px chrome rail now sitting above the search input.
    if (loginPromptOpen) {
      window.electronAPI.setWindowHeight(440)
    } else if ((query && (response || loading)) || (!query && history.length > 0)) {
      window.electronAPI.setWindowHeight(query ? 460 : 284)
    } else {
      window.electronAPI.setWindowHeight(128)
    }
  }, [history, loading, loginPromptOpen, query, response])

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-container">
        <motion.div
          className="glass-window"
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <WindowControls />

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
                      <div
                        key={word}
                        className="group -mx-2 flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-white/5"
                      >
                        <button
                          onClick={() => setQuery(word)}
                          className="min-w-0 flex-1 truncate text-left text-white/80 text-sm hover:text-white"
                        >
                          {word}
                        </button>
                        <button
                          onClick={() => handleRemoveRecent(word)}
                          aria-label={`Remove ${word} from recent`}
                          title="Remove from recent"
                          className="shrink-0 rounded p-1 text-white/35 opacity-0 transition hover:bg-white/10 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <svg
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
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
    </MotionConfig>
  )
}
