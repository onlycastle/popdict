import { motion } from 'framer-motion'
import type { LookupFailure, SearchResponse } from '../types/dictionary'
import { getAttributedAudio, pronounce } from '../utils/pronounce'
import { wiktionarySearchUrl } from '../services/dictionary/recovery'

interface SearchResultsProps {
  response: SearchResponse | null
  loading: boolean
  failure: LookupFailure | null
  query: string
  recoverySuggestions?: string[]
  onLookup?: (word: string) => void
  onRetry?: () => void
  onSave?: () => void
  saveDisabled?: boolean
  saveFeedback?: string
  saveFeedbackTone?: 'error' | 'success'
  saveLabel?: string
}

const SearchResults = ({
  response,
  loading,
  failure,
  query,
  recoverySuggestions = [],
  onLookup,
  onRetry,
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

  if (failure && failure.kind !== 'not-found') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="results-container"
      >
        <div className="text-center py-10">
          <p className="text-red-300 text-sm">{failure.message}</p>
          {onRetry && (
            <button type="button" className="btn-ghost mt-3 text-xs" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  if (failure?.kind === 'not-found' || !response || !response.dictionaryResults) {
    const isPhrase = /\s/.test(query.trim())
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
          {recoverySuggestions.length > 0 && onLookup && (
            <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Suggestions">
              {recoverySuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="related-word-button"
                  onClick={() => onLookup(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          {isPhrase && (
            <a
              className="mt-4 inline-block text-xs text-amber-300/80 hover:text-amber-200"
              href={wiktionarySearchUrl(query)}
              target="_blank"
              rel="noreferrer noopener"
            >
              Search Wiktionary
            </a>
          )}
        </div>
      </motion.div>
    )
  }

  const { dictionaryResults } = response
  const firstResult = dictionaryResults?.[0]
  const attributedAudio = getAttributedAudio(firstResult)
  const entryAttributions = firstResult?.attributions?.length
    ? firstResult.attributions
    : firstResult?.sourceUrls?.map((sourceUrl, index) => ({
      label: firstResult.sourceUrls!.length > 1 ? `Entry source ${index + 1}` : 'Entry source',
      sourceUrl,
      ...(index === 0 && firstResult.license ? { license: firstResult.license } : {}),
    })) ?? (firstResult?.license ? [{ label: 'Entry license', license: firstResult.license }] : [])

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="results-container"
    >
      {/* Dictionary entry */}
      {firstResult && (
        <>
          {response.provenance === 'cache' && response.cachedAt && (
            <p className="cache-provenance" role="status">
              Offline copy saved {new Date(response.cachedAt).toLocaleDateString()}
            </p>
          )}
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
                  onClick={() => pronounce(
                    firstResult.word,
                    response.provenance === 'cache' ? undefined : attributedAudio?.url
                  )}
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
                        {def.usageLabels && def.usageLabels.length > 0 && (
                          <p className="dict-label mb-1">{def.usageLabels.join(' · ')}</p>
                        )}
                        <p className="text-white/90 text-sm leading-relaxed">{def.definition}</p>
                        {def.example && (
                          <p className="dict-example text-xs mt-2 leading-relaxed">{def.example}</p>
                        )}
                        {def.synonyms && def.synonyms.length > 0 && (
                          <div className="mt-2 flex items-start gap-1.5">
                            <span className="dict-label">Similar</span>
                            <span className="flex flex-wrap gap-1.5">
                              {def.synonyms.slice(0, 5).map((word) => (
                                <button
                                  key={word}
                                  type="button"
                                  className="related-word-button"
                                  onClick={() => onLookup?.(word)}
                                >
                                  {word}
                                </button>
                              ))}
                            </span>
                          </div>
                        )}
                        {def.antonyms && def.antonyms.length > 0 && (
                          <div className="mt-2 flex items-start gap-1.5">
                            <span className="dict-label">Opposite</span>
                            <span className="flex flex-wrap gap-1.5">
                              {def.antonyms.slice(0, 5).map((word) => (
                                <button
                                  key={word}
                                  type="button"
                                  className="related-word-button"
                                  onClick={() => onLookup?.(word)}
                                >
                                  {word}
                                </button>
                              ))}
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

          {(entryAttributions.length > 0 || attributedAudio) && (
            <p className="dictionary-attribution">
              {entryAttributions.map((attribution, index) => (
                <span key={`${attribution.label}:${attribution.sourceUrl ?? index}`}>
                  {index > 0 ? ' · ' : ''}
                  {attribution.sourceUrl ? (
                    <a href={attribution.sourceUrl} target="_blank" rel="noreferrer noopener">
                      {attribution.label}
                    </a>
                  ) : attribution.label}
                  {attribution.license && (
                    <>
                      {' · '}
                      <a
                        href={attribution.license.url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {attribution.license.name}
                      </a>
                    </>
                  )}
                </span>
              ))}
              {entryAttributions.length > 0 && attributedAudio ? ' · ' : ''}
              {attributedAudio && (
                <>
                  <a
                    href={attributedAudio.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Audio source
                  </a>
                  {' · '}
                  <a
                    href={attributedAudio.license.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Audio {attributedAudio.license.name}
                  </a>
                </>
              )}
            </p>
          )}
        </>
      )}
    </motion.div>
  )
}

export default SearchResults
