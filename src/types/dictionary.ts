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

export type SearchSource = 'free-dictionary'

export interface SearchResponse {
  dictionaryResults: DictionaryResult[] | null
  source: SearchSource
}
