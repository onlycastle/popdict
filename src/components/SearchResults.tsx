import { motion } from 'framer-motion'
import { SearchResponse } from '../types/dictionary'

interface SearchResultsProps {
  response: SearchResponse | null
  loading: boolean
  error: string | null
  query: string
}

const SearchResults = ({ response, loading, error, query }: SearchResultsProps) => {
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
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-400/30 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block text-xs font-semibold text-blue-300 bg-blue-500/20 px-2 py-1 rounded-md">
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
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white leading-tight">
              {firstResult.word}
            </h2>
            {firstResult.phonetic && (
              <p className="text-white/80 text-sm mt-2">
                {firstResult.phonetic}
              </p>
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
