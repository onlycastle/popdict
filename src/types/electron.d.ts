import type { TargetLanguage } from '../../shared/language'
import type { CachedLookup, SearchResponse } from './dictionary'
import type { WordTranslation } from '../../shared/language'
import type { ReviewReminderSettings } from '../../shared/reminders'

export type AppSettings = {
  hotkey: string
  launchAtLogin: boolean
  signInNudgeDismissedAt: number | null
  translationLanguage: TargetLanguage | null
  analyticsEnabled: boolean
  reviewReminders: ReviewReminderSettings
  notificationsSupported: boolean
}

export interface ElectronAPI {
  lookupLocalDictionary: (query: string) => Promise<import('./dictionary').DictionaryResult[]>
  lookupLocalTranslations: (word: string, language: TargetLanguage) => Promise<WordTranslation[]>
  localLibrary: (command: import('../../shared/local').LocalLibraryCommand) => Promise<import('../../shared/local').LocalLibraryResult>
  localReviewCount: () => Promise<number>
  localReviewStart: () => Promise<import('../services/QuizSessionService').QuizSession>
  localReviewAnswer: (id: string, choice: number) => Promise<import('../services/QuizSessionService').AnswerResult>
  hideWindow: () => void
  setWindowHeight: (height: number) => void
  onFocusSearch: (cb: () => void) => void
  onAuthCallback: (cb: (url: string) => void) => () => void
  consumeAuthCallback: () => Promise<string | null>
  getAppVersion: () => Promise<string>
  getAnalyticsSessionId: () => Promise<string>
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  getHistory: () => Promise<string[]>
  addHistory: (word: string) => Promise<string[]>
  removeHistory: (word: string) => Promise<string[]>
  clearHistory: () => Promise<void>
  readLookupCache: (query: string) => Promise<CachedLookup | null>
  writeLookupCache: (input: {
    query: string
    response: SearchResponse
    translationLanguage?: TargetLanguage | null
    translations?: WordTranslation[]
  }) => Promise<void>
  clearLookupCache: () => Promise<void>
  exportSavedWordsCsv: (csv: string) => Promise<boolean>
  onReminderDueCountRequest: (cb: (nonce: string) => void) => () => void
  sendReminderDueCount: (nonce: string, count: number) => void
  getSpellingSuggestions: (word: string) => string[]
  recordLookupSuccess: () => Promise<number>
  openSettings: () => void
  openSavedWords: () => void
  openReview: () => void
  finishOnboarding: () => void
  lookupWord: (word: string) => void
  onSeedSearch: (cb: (word: string) => void) => () => void
  onOpenFeedback: (cb: () => void) => () => void
  changeHotkey: (accelerator: string) => Promise<boolean>
  openExternalUrl: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
