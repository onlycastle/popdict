import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { FeedbackPayload } from '../shared/feedback'
import type { TargetLanguage } from '../shared/language'

type AppSettings = {
  hotkey: string
  launchAtLogin: boolean
  translationLanguage: TargetLanguage | null
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
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  setSettings: (partial: Partial<AppSettings>) => ipcRenderer.invoke('set-settings', partial),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (word: string) => ipcRenderer.invoke('add-history', word),
  removeHistory: (word: string) => ipcRenderer.invoke('remove-history', word),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  openSettings: () => ipcRenderer.send('open-settings'),
  openSavedWords: () => ipcRenderer.send('open-saved-words'),
  openReview: () => ipcRenderer.send('open-review'),
  finishOnboarding: () => ipcRenderer.send('finish-onboarding'),
  lookupWord: (word: string) => ipcRenderer.send('lookup-word', word),
  onSeedSearch: (callback: (word: string) => void) => {
    const listener = (_event: IpcRendererEvent, word: string) => callback(word)
    ipcRenderer.on('seed-search', listener)
    return () => ipcRenderer.removeListener('seed-search', listener)
  },
  sendFeedback: (payload?: FeedbackPayload) => ipcRenderer.invoke('send-feedback', payload),
  changeHotkey: (accelerator: string) => ipcRenderer.invoke('change-hotkey', accelerator),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
})
