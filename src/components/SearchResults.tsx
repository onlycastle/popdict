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
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-white/30 border-t-white/80 rounded-full" />
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="results-container"
      >
        <div className="text-center py-12">
          <p className="text-red-400 text-sm">{error}</p>
          <p className="text-white/70 text-xs mt-2">
            Try a different word
          </p>
        </div>
      </motion.div>
    )
  }

  if (!response || (!response.dictionaryResults && !response.idiomResult)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="results-container"
      >
        <div className="text-center py-12">
          <p className="text-white/80 text-sm">
            No results found for "{query}"
          </p>
        </div>
      </motion.div>
    )
  }

  const { dictionaryResults, idiomResult } = response
  const firstResult = dictionaryResults?.[0]
  const audioUrl = getAudioUrl(firstResult)

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="results-container"
    >
      {/* Idiom section - shown first if available */}
      {idiomResult && (
        <div className="idiom-card mb-6 p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <span className="idiom-badge inline-block text-xs font-semibold px-2 py-1 rounded-md">
              IDIOM
            </span>
          </div>
          <h3 className="text-lg font-bold text-white mb-2 leading-tight">
            {idiomResult.term}
          </h3>
          <p className="text-white/90 text-sm leading-relaxed mb-2">
            {idiomResult.explanation}
          </p>
          {idiomResult.example && (
            <p className="text-white/70 text-xs italic leading-relaxed mt-3">
              "{idiomResult.example}"
            </p>
          )}
        </div>
      )}

      {/* Dictionary results section */}
      {firstResult && (
        <>
          {/* Word header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-bold leading-tight text-white">
                {firstResult.word}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                {firstResult.phonetic && (
                  <p className="text-white/80 text-sm">
                    {firstResult.phonetic}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => pronounce(firstResult.word, audioUrl)}
                  aria-label={`Play pronunciation of ${firstResult.word}`}
                  title="Play pronunciation"
                  className="shrink-0 rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
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
                <p className={`mt-2 text-xs ${saveFeedbackTone === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
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

          {/* Meanings */}
          <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
            {firstResult.meanings.map((meaning, meaningIndex) => (
              <div key={meaningIndex} className="meaning-section">
                <span className="inline-block text-xs font-semibold text-white bg-white/10 px-2 py-1 rounded-md mb-3">
                  {meaning.partOfSpeech}
                </span>

                <div className="space-y-4">
                  {meaning.definitions.slice(0, 3).map((def, defIndex) => (
                    <div key={defIndex} className="definition-item">
                      <p className="text-white/90 text-sm leading-relaxed">
                        {defIndex + 1}. {def.definition}
                      </p>
                      {def.example && (
                        <p className="text-white/70 text-xs mt-2 italic leading-relaxed">
                          "{def.example}"
                        </p>
                      )}
                      {def.synonyms && def.synonyms.length > 0 && (
                        <div className="mt-2">
                          <span className="text-white/70 text-xs">Similar: </span>
                          <span className="text-white/80 text-xs">
                            {def.synonyms.slice(0, 3).join(', ')}
                          </span>
                        </div>
                      )}
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
