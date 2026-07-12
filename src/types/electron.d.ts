import type { FeedbackOpenResult, FeedbackPayload } from '../../shared/feedback'

export type AppSettings = {
  hotkey: string
  launchAtLogin: boolean
  lookupCount: number
  signInNudgeDismissedAt: number | null
}

export type AppSettingsPatch = Partial<
  Pick<AppSettings, 'launchAtLogin' | 'signInNudgeDismissedAt'>
>

export interface ElectronAPI {
  hideWindow: () => void
  setWindowHeight: (height: number) => void
  onFocusSearch: (cb: () => void) => void
  onAuthCallback: (cb: (url: string) => void) => () => void
  consumeAuthCallback: () => Promise<string | null>
  getAppVersion: () => Promise<string>
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: AppSettingsPatch) => Promise<AppSettings>
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
