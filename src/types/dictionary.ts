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

export interface DictionaryResult {
  word: string
  phonetic?: string
  phonetics?: Array<{
    text?: string
    audio?: string
  }>
  origin?: string
  meanings: Meaning[]
}

export interface IdiomResult {
  term: string
  explanation: string
  example?: string
}

export type SearchSource = 'free-dictionary' | 'phrases-api' | 'both' | 'krdict' | 'en-ko'

export interface SearchResponse {
  dictionaryResults: DictionaryResult[] | null
  idiomResult: IdiomResult | null
  /** Korean equivalents of an English query — augmentation, null when absent. */
  koTranslations: string[] | null
  source: SearchSource
}
