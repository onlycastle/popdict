import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

type AppSettings = {
  hotkey: string
  lookupSelection: boolean
  launchAtLogin: boolean
}

contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  setWindowHeight: (height: number) => ipcRenderer.send('set-window-height', height),
  onFocusSearch: (callback: () => void) => {
    ipcRenderer.on('focus-search', callback)
  },
  onAuthCallback: (callback: (url: string) => void) => {
    const listener = (_event: IpcRendererEvent, url: string) => callback(url)
    ipcRenderer.on('auth-callback', listener)
    return () => ipcRenderer.removeListener('auth-callback', listener)
  },
  consumeAuthCallback: () => ipcRenderer.invoke('consume-auth-callback'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (partial: Partial<AppSettings>) => ipcRenderer.invoke('set-settings', partial),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (word: string) => ipcRenderer.invoke('add-history', word),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  openSettings: () => ipcRenderer.send('open-settings'),
  openSavedWords: () => ipcRenderer.send('open-saved-words'),
  finishOnboarding: () => ipcRenderer.send('finish-onboarding'),
  isAccessibilityTrusted: () => ipcRenderer.invoke('is-accessibility-trusted'),
  requestAccessibility: () => ipcRenderer.invoke('request-accessibility'),
  lookupWord: (word: string) => ipcRenderer.send('lookup-word', word),
  onSeedSearch: (callback: (word: string) => void) => {
    const listener = (_event: IpcRendererEvent, word: string) => callback(word)
    ipcRenderer.on('seed-search', listener)
    return () => ipcRenderer.removeListener('seed-search', listener)
  },
  sendFeedback: () => ipcRenderer.send('send-feedback'),
  changeHotkey: (accelerator: string) => ipcRenderer.invoke('change-hotkey', accelerator),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
})
