import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import FeedbackDialog from '../components/FeedbackDialog'
import LoginModal from '../components/LoginModal'
import SearchInput from '../components/SearchInput'
import SearchResults from '../components/SearchResults'
import WindowControls from '../components/WindowControls'
import { useDictionarySearch } from '../hooks/useDictionarySearch'
import { useSupabaseAuth } from '../hooks/useSupabaseAuth'
import { useSaveWord } from '../hooks/useSaveWord'
import '../App.css'

// The login modal is absolutely positioned, so it contributes no layout height
// for the ResizeObserver to measure — give it a fixed window height instead.
const LOGIN_MODAL_HEIGHT = 440
const FEEDBACK_MODAL_HEIGHT = 520

export default function SearchView() {
  const [query, setQuery] = useState('')
  const { response, loading, error, triggerSearch, searchedTerm } = useDictionarySearch(query)
  const auth = useSupabaseAuth()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const glassRef = useRef<HTMLDivElement>(null)
  const [history, setHistory] = useState<string[]>([])
  const [feedbackOpen, setFeedbackOpen] = useState(false)

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
        if (feedbackOpen) {
          setFeedbackOpen(false)
          return
        }
        if (window.electronAPI) {
          window.electronAPI.hideWindow()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [feedbackOpen, loginPromptOpen, setLoginPromptOpen])

  const handleRemoveRecent = useCallback((word: string) => {
    window.electronAPI?.removeHistory(word).then(setHistory)
  }, [])

  // Size the window to the glass panel's real rendered height. The panel is
  // content-sized (capped by its CSS max-height), independent of the window's
  // current height, so this never feeds back on itself. Modals are absolutely
  // positioned (no layout height), hence the explicit floor.
  const loginOpenRef = useRef(loginPromptOpen)
  loginOpenRef.current = loginPromptOpen
  const feedbackOpenRef = useRef(feedbackOpen)
  feedbackOpenRef.current = feedbackOpen
  const applyWindowHeight = useCallback(() => {
    const el = glassRef.current
    if (!el || !window.electronAPI?.setWindowHeight) return
    const measured = Math.ceil(el.getBoundingClientRect().height)
    const modalHeight = Math.max(
      loginOpenRef.current ? LOGIN_MODAL_HEIGHT : 0,
      feedbackOpenRef.current ? FEEDBACK_MODAL_HEIGHT : 0
    )
    const height = modalHeight ? Math.max(measured, modalHeight) : measured
    window.electronAPI.setWindowHeight(height)
  }, [])

  useEffect(() => {
    const el = glassRef.current
    if (!el) return
    const observer = new ResizeObserver(applyWindowHeight)
    observer.observe(el)
    applyWindowHeight()
    return () => observer.disconnect()
  }, [applyWindowHeight])

  useEffect(applyWindowHeight, [applyWindowHeight, feedbackOpen, loginPromptOpen])

  const hasRecent = !query && history.length > 0
  const showContent = Boolean(query) || hasRecent

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-container">
        <motion.div
          ref={glassRef}
          className="glass-window"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <div className="search-row">
            <SearchInput
              ref={searchInputRef}
              value={query}
              onChange={setQuery}
              onSearch={triggerSearch}
              loading={loading}
            />
            <WindowControls onFeedbackClick={() => setFeedbackOpen(true)} />
          </div>

          {showContent && <div className="content-divider" />}

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
            {hasRecent && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="empty-state"
              >
                <div className="recent-list">
                  <p className="dict-label mb-2">Recent</p>
                  {history.map((word) => (
                    <div
                      key={word}
                      className="group -mx-2 flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white/5"
                    >
                      <button
                        onClick={() => setQuery(word)}
                        className="min-w-0 flex-1 truncate text-left text-white/75 text-sm hover:text-white"
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
          <FeedbackDialog
            context={
              searchedTerm
                ? `Search term: ${searchedTerm}`
                : query.trim()
                  ? `Typed query: ${query.trim()}`
                  : undefined
            }
            onClose={() => setFeedbackOpen(false)}
            open={feedbackOpen}
          />
        </motion.div>
      </div>
    </MotionConfig>
  )
}
