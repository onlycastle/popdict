import type { TargetLanguage } from '../../shared/language'
import type { SearchSource } from './dictionary'

export type MasteryState = 'new' | 'learning' | 'mastered'

export type SavedWordDetails = {
  partOfSpeech: string | null
  definition: string | null
  example: string | null
  synonyms: string[]
  antonyms: string[]
  translation: string | null
  translationLanguage: TargetLanguage | null
  sourceUrl: string | null
  licenseName: string | null
  licenseUrl: string | null
  detailsUpdatedAt: string
}

export type SavedWordTag = {
  id: string
  savedWordId: string
  tag: string
  normalizedTag: string
  createdAt: string
}

export type SavedWordReview = {
  box: number
  nextDueAt: string
  updatedAt: string
}

export type SavedWordRecord = {
  id: string
  word: string
  normalizedWord: string
  source: SearchSource
  createdAt: string
  updatedAt: string
  note: string
  details: SavedWordDetails | null
  tags: SavedWordTag[]
  review: SavedWordReview | null
  mastery: MasteryState
  due: boolean
}
