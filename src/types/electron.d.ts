export type AppSettings = {
  hotkey: string
  lookupSelection: boolean
  launchAtLogin: boolean
}

export interface ElectronAPI {
  hideWindow: () => void
  setWindowHeight: (height: number) => void
  onFocusSearch: (cb: () => void) => void
  onAuthCallback: (cb: (url: string) => void) => () => void
  consumeAuthCallback: () => Promise<string | null>
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  getHistory: () => Promise<string[]>
  addHistory: (word: string) => Promise<string[]>
  clearHistory: () => Promise<void>
  openSettings: () => void
  openSavedWords: () => void
  finishOnboarding: () => void
  isAccessibilityTrusted: () => Promise<boolean>
  requestAccessibility: () => Promise<boolean>
  lookupWord: (word: string) => void
  onSeedSearch: (cb: (word: string) => void) => () => void
  sendFeedback: () => void
  changeHotkey: (accelerator: string) => Promise<boolean>
  openExternalUrl: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
