import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SearchInput from './components/SearchInput'
import SearchResults from './components/SearchResults'
import { useDictionarySearch } from './hooks/useDictionarySearch'
import Settings from './components/Settings'
import './App.css'

function App() {
  // Settings opens as a separate window at #/settings. This check MUST stay
  // above every hook below: a window's hash is constant for its lifetime, so
  // the search hooks run for the search window and never for the settings
  // window, keeping hook order stable (React's Rules of Hooks).
  if (window.location.hash === '#/settings') {
    return <Settings />
  }

  const [query, setQuery] = useState('')
  const { response, loading, error, triggerSearch } = useDictionarySearch(query)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Focus search input when window is shown
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onFocusSearch(() => {
        searchInputRef.current?.focus()
      })
    }
  }, [])

  // Handle ESC key to hide window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (window.electronAPI) {
          window.electronAPI.hideWindow()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Dynamically adjust window height based on content
  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.setWindowHeight) return

    // If we have results or are loading with a query, expand window
    if (query && (response || loading)) {
      // Expanded height: search input + results area
      window.electronAPI.setWindowHeight(400)
    } else {
      // Compact height: just search input
      window.electronAPI.setWindowHeight(80)
    }
  }, [query, response, loading])

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
              <p className="text-white/80 text-sm">
                Start typing to search dictionary...
              </p>
              <p className="text-white/70 text-xs mt-2">
                Press ESC to close
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

export default App
