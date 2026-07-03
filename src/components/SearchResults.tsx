import { motion } from 'framer-motion'
import { SearchResponse } from '../types/dictionary'
import { getAudioUrl, pronounce } from '../utils/pronounce'

interface SearchResultsProps {
  response: SearchResponse | null
  loading: boolean
  error: string | null
  query: string
  onSave?: () => void
  saveDisabled?: boolean
  saveFeedback?: string
  saveFeedbackTone?: 'error' | 'success'
  saveLabel?: string
}

const SearchResults = ({
  response,
  loading,
  error,
  query,
  onSave,
  saveDisabled,
  saveFeedback,
  saveFeedbackTone = 'success',
  saveLabel = 'Save',
}: SearchResultsProps) => {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="results-container"
      >
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin h-6 w-6 border-2 border-white/25 border-t-white/70 rounded-full" />
        </div>
      </motion.div>
    )
  }

  // "No such word" is a normal outcome, not a failure — render it in the
  // quiet no-entry voice. Red stays reserved for real errors (offline, 5xx).
  const isNotFound = error !== null && /not found|no results/i.test(error)

  if (error && !isNotFound) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="results-container"
      >
        <div className="text-center py-10">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </motion.div>
    )
  }

  if (isNotFound || !response || (!response.dictionaryResults && !response.idiomResult)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="results-container"
      >
        <div className="text-center py-10">
          <p className="text-white/75 text-sm">No entry found for “{query}”</p>
          <p className="text-white/55 text-xs mt-2">Check the spelling or try the base form</p>
        </div>
      </motion.div>
    )
  }

  const { dictionaryResults, idiomResult } = response
  const firstResult = dictionaryResults?.[0]
  const audioUrl = getAudioUrl(firstResult)

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="results-container"
    >
      {/* Idiom section - shown first if available */}
      {idiomResult && (
        <div className="idiom-card mb-5 p-4 border rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="idiom-badge inline-block px-2 py-1 rounded-md">idiom</span>
          </div>
          <h3 className="dict-headword text-xl mb-2 leading-tight">{idiomResult.term}</h3>
          <p className="text-white/90 text-sm leading-relaxed mb-2">{idiomResult.explanation}</p>
          {idiomResult.example && (
            <p className="dict-example text-sm leading-relaxed mt-3">{idiomResult.example}</p>
          )}
        </div>
      )}

      {/* Dictionary entry */}
      {firstResult && (
        <>
          {/* Headword block */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="dict-headword break-words text-3xl leading-tight">
                {firstResult.word}
              </h2>
              <div className="mt-1.5 flex items-center gap-2">
                {firstResult.phonetic && <p className="dict-ipa">{firstResult.phonetic}</p>}
                <button
                  type="button"
                  onClick={() => pronounce(firstResult.word, audioUrl)}
                  aria-label={`Play pronunciation of ${firstResult.word}`}
                  title="Play pronunciation"
                  className="shrink-0 rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M13 3.5a1 1 0 0 0-1.6-.8L6.66 6.5H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2.66l4.74 3.8a1 1 0 0 0 1.6-.8v-17Z" />
                    <path d="M16.5 8.5a1 1 0 0 1 1.4 0 5 5 0 0 1 0 7 1 1 0 1 1-1.4-1.42 3 3 0 0 0 0-4.16 1 1 0 0 1 0-1.42Z" />
                    <path d="M18.9 5.6a1 1 0 0 1 1.42 0 9 9 0 0 1 0 12.8 1 1 0 1 1-1.42-1.42 7 7 0 0 0 0-9.96 1 1 0 0 1 0-1.42Z" />
                  </svg>
                </button>
              </div>
              {saveFeedback && (
                <p
                  className={`mt-2 text-xs ${saveFeedbackTone === 'error' ? 'text-red-300' : 'text-emerald-300'}`}
                >
                  {saveFeedback}
                </p>
              )}
            </div>

            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saveDisabled}
                className="save-word-button"
              >
                {saveLabel}
              </button>
            )}
          </div>

          {/* Senses, grouped by part of speech and separated by hairlines. */}
          <div>
            {firstResult.meanings.map((meaning, meaningIndex) => (
              <div key={meaningIndex} className="sense-group">
                <span className="dict-pos mb-2.5 inline-block">{meaning.partOfSpeech}</span>

                <div className="space-y-3.5">
                  {meaning.definitions.slice(0, 3).map((def, defIndex) => (
                    <div key={defIndex} className="flex gap-2.5">
                      <span className="dict-sense-num w-4 shrink-0 text-right leading-relaxed text-sm">
                        {defIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-white/90 text-sm leading-relaxed">{def.definition}</p>
                        {def.example && (
                          <p className="dict-example text-xs mt-2 leading-relaxed">{def.example}</p>
                        )}
                        {def.synonyms && def.synonyms.length > 0 && (
                          <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="dict-label">Similar</span>
                            <span className="text-white/75 text-xs">
                              {def.synonyms.slice(0, 3).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}

export default SearchResults
