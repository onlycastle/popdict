import type { FeedbackOpenResult, FeedbackPayload } from '../../shared/feedback'

export type AppSettings = {
  hotkey: string
  launchAtLogin: boolean
}

export interface ElectronAPI {
  hideWindow: () => void
  setWindowHeight: (height: number) => void
  onFocusSearch: (cb: () => void) => void
  onAuthCallback: (cb: (url: string) => void) => () => void
  consumeAuthCallback: () => Promise<string | null>
  getAppVersion: () => Promise<string>
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  getHistory: () => Promise<string[]>
  addHistory: (word: string) => Promise<string[]>
  removeHistory: (word: string) => Promise<string[]>
  clearHistory: () => Promise<void>
  openSettings: () => void
  openSavedWords: () => void
  openReview: () => void
  finishOnboarding: () => void
  lookupWord: (word: string) => void
  onSeedSearch: (cb: (word: string) => void) => () => void
  sendFeedback: (payload?: FeedbackPayload) => Promise<FeedbackOpenResult>
  changeHotkey: (accelerator: string) => Promise<boolean>
  openExternalUrl: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
