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
