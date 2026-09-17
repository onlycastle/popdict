import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import FeedbackDialog from '../components/FeedbackDialog'
import FeedbackNudge from '../components/FeedbackNudge'
import ReviewChip from '../components/ReviewChip'
import SearchInput from '../components/SearchInput'
import SearchResults from '../components/SearchResults'
import TranslationCard from '../components/TranslationCard'
import { translationPanelState } from '../components/translationPresentation'
import WindowControls from '../components/WindowControls'
import { useDictionarySearch } from '../hooks/useDictionarySearch'
import { translationIsSettledForSave, useSaveWord } from '../hooks/useSaveWord'
import { useTranslations } from '../hooks/useTranslations'
import type { AppSettings } from '../types/electron'
import { normalizeEnglishWord, type WordTranslation } from '../../shared/language'
import { handleSearchWindowFocus } from './searchFocus'
import { productAnalytics } from '../services/ProductAnalytics'
import { QuizSessionService } from '../services/QuizSessionService'
import { handleLookupSelection } from './lookupSelection'
import '../App.css'

// The feedback modal is positioned outside normal layout, so reserve its height.
const FEEDBACK_MODAL_HEIGHT = 520
const quizSessions = new QuizSessionService()

export default function SearchView() {
  const [query, setQuery] = useState('')
  const {
    response,
    loading,
    failure,
    recoverySuggestions,
    cachedLookup,
    triggerSearch,
    searchedTerm,
  } = useDictionarySearch(query)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const glassRef = useRef<HTMLDivElement>(null)
  const [history, setHistory] = useState<string[]>([])
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackNudgeOpen, setFeedbackNudgeOpen] = useState(false)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const translationLanguage = settings?.translationLanguage ?? null
  const canonicalWord = normalizeEnglishWord(response?.dictionaryResults?.[0]?.word ?? '')
  const translationEligible = Boolean(
    response && !loading && !failure && canonicalWord && translationLanguage
  )
  const cacheResolvedTranslations = useCallback((resolved: WordTranslation[]) => {
    if (!response || response.provenance !== 'live' || !translationLanguage || !searchedTerm) return
    void window.electronAPI?.writeLookupCache({
      query: searchedTerm,
      response,
      translationLanguage,
      translations: resolved,
    })
  }, [response, searchedTerm, translationLanguage])
  const translations = useTranslations({
    word: canonicalWord ?? '',
    language: translationLanguage,
    enabled: translationEligible,
    cachedTranslations: translationLanguage
      ? cachedLookup?.translations[translationLanguage]
      : undefined,
    cachedOnly: response?.provenance === 'cache',
    onResolved: cacheResolvedTranslations,
  })
  const translationPanel = translationPanelState({
    language: translationLanguage,
    canonicalWord,
    lookupStatus: translations.status,
  })

  const {
    wordToSave,
    savedWord,
    saveError,
    saving,
    alreadySaved,
    saveLabel,
    handleSaveClick,
  } = useSaveWord({
    response,
    searchedTerm,
    query,
    translationLanguage,
    translationStatus: translations.status,
    translationRequired: translationEligible,
    translations: translations.translations,
  })

  const refreshSettings = useCallback(() => {
    void window.electronAPI?.getSettings().then(setSettings)
  }, [])

  useEffect(() => {
    window.electronAPI?.getHistory().then(setHistory)
    refreshSettings()
  }, [refreshSettings])

  useEffect(() => window.electronAPI.onReminderDueCountRequest((nonce) => {
    void quizSessions.dueCount().then((count) => {
      window.electronAPI.sendReminderDueCount(nonce, count)
    }, () => {
      window.electronAPI.sendReminderDueCount(nonce, 0)
    })
  }), [])

  // Record the term that produced the current result (not the live query,
  // which runs ahead of the debounced search).
  useEffect(() => {
    if (response && !failure && searchedTerm) {
      window.electronAPI?.addHistory(searchedTerm).then(setHistory)
      void productAnalytics.track('lookup_success')
      if (response.provenance === 'cache') void productAnalytics.track('offline_cache_hit')
      if (response.source === 'kaikki-phrases' || response.source === 'combined') {
        void productAnalytics.track('phrase_lookup_success')
      }
      void window.electronAPI?.recordLookupSuccess().then((count) => {
        if (count === 3) setFeedbackNudgeOpen(true)
      })
    }
  }, [response, failure, searchedTerm])

  // Focus search input when window is shown
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onFocusSearch(() => {
        handleSearchWindowFocus(refreshSettings, () => searchInputRef.current?.focus())
      })
    }
  }, [refreshSettings])

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
  }, [feedbackOpen])

  const handleRemoveRecent = useCallback((word: string) => {
    window.electronAPI?.removeHistory(word).then(setHistory)
  }, [])

  // Size the window to the glass panel's real rendered height. The panel is
  // content-sized (capped by its CSS max-height), independent of the window's
  // current height, so this never feeds back on itself. Modals are absolutely
  // positioned (no layout height), hence the explicit floor.
  const feedbackOpenRef = useRef(feedbackOpen)
  feedbackOpenRef.current = feedbackOpen
  const applyWindowHeight = useCallback(() => {
    const el = glassRef.current
    if (!el || !window.electronAPI?.setWindowHeight) return
    const measured = Math.ceil(el.getBoundingClientRect().height)
    const modalHeight = feedbackOpenRef.current ? FEEDBACK_MODAL_HEIGHT : 0
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

  useEffect(applyWindowHeight, [applyWindowHeight, feedbackOpen])

  const hasRecent = !query && history.length > 0
  const showEmptyState = !query
  const showContent = Boolean(query) || showEmptyState
  const modalOpen = feedbackOpen

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-container">
        <motion.div
          ref={glassRef}
          className={`glass-window${modalOpen ? ' modal-open' : ''}`}
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
                failure={failure}
                query={query}
                recoverySuggestions={recoverySuggestions}
                onRecoveryLookup={(word) => handleLookupSelection('recovery', word, {
                  setQuery,
                  focusSearch: () => searchInputRef.current?.focus(),
                  trackRecovery: () => { void productAnalytics.track('lookup_recovery_used') },
                })}
                onRelatedLookup={(word) => handleLookupSelection('related', word, {
                  setQuery,
                  focusSearch: () => searchInputRef.current?.focus(),
                  trackRecovery: () => { void productAnalytics.track('lookup_recovery_used') },
                })}
                onRetry={triggerSearch}
                onSave={response && !loading && !failure ? () => void handleSaveClick() : undefined}
                saveDisabled={saving || alreadySaved || !translationIsSettledForSave(
                  translationLanguage,
                  translations.status,
                  translationEligible,
                )}
                saveFeedback={
                  saveError || (savedWord.toLowerCase() === wordToSave.toLowerCase() ? 'Saved' : '')
                }
                saveFeedbackTone={saveError ? 'error' : 'success'}
                saveLabel={saveLabel}
              />
            )}
          </AnimatePresence>

          {translationPanel !== 'hidden' && translationLanguage && canonicalWord && (
            translations.status !== 'empty' && translations.status !== 'idle' ? (
              <TranslationCard
                language={translationLanguage}
                word={canonicalWord}
                state={translationPanel}
                translations={translations.translations}
                onRetry={translations.retry}
              />
            ) : null
          )}

          <AnimatePresence mode="wait">
            {showEmptyState && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="empty-state"
              >
                <ReviewChip />
                {hasRecent && (
                  <details className="recent-list">
                    <summary className="dict-label cursor-pointer select-none">Recent</summary>
                    <div className="mt-2">
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
                  </details>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {feedbackNudgeOpen && !feedbackOpen && (
            <FeedbackNudge
              onDismiss={() => setFeedbackNudgeOpen(false)}
              onShare={() => {
                setFeedbackNudgeOpen(false)
                setFeedbackOpen(true)
              }}
            />
          )}

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
