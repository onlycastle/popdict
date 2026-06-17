export type AppSettings = {
  hotkey: string
  stands4Uid: string
  stands4Token: string
  launchAtLogin: boolean
}

export interface ElectronAPI {
  hideWindow: () => void
  setWindowHeight: (height: number) => void
  onFocusSearch: (cb: () => void) => void
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  getHistory: () => Promise<string[]>
  addHistory: (word: string) => Promise<string[]>
  clearHistory: () => Promise<void>
  getStands4Credentials: () => Promise<{ uid: string; token: string }>
  openSettings: () => void
  sendFeedback: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
