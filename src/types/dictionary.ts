export interface Definition {
  definition: string
  example?: string
  synonyms?: string[]
  antonyms?: string[]
}

export interface Meaning {
  partOfSpeech: string
  definitions: Definition[]
}

export interface DictionaryLicense {
  name: string
  url: string
}

export interface DictionaryResult {
  word: string
  phonetic?: string
  phonetics?: Array<{
    text?: string
    audio?: string
    sourceUrl?: string
    license?: DictionaryLicense
  }>
  origin?: string
  meanings: Meaning[]
  license?: DictionaryLicense
  sourceUrls?: string[]
}

export type SearchSource = 'free-dictionary' | 'kaikki-phrases' | 'combined'

export type LookupFailureKind = 'not-found' | 'network' | 'service'

export interface LookupFailure {
  kind: LookupFailureKind
  message: string
  query: string
}

export interface SearchResponse {
  dictionaryResults: DictionaryResult[] | null
  source: SearchSource
  provenance: 'live' | 'cache'
  cachedAt?: string
}

export interface CachedLookup {
  version: 1
  query: string
  normalizedQuery: string
  response: SearchResponse
  translations: Partial<Record<import('../../shared/language').TargetLanguage, import('../../shared/language').WordTranslation[]>>
  savedAt: string
  lastAccessedAt: string
}
