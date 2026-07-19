import { contextBridge, ipcRenderer, type IpcRendererEvent, webFrame } from 'electron'
import type { TargetLanguage } from '../shared/language'
import type { LookupCacheWrite } from './lookupCache'
import type { ReviewReminderSettings } from '../shared/reminders'

type AppSettings = {
  hotkey: string
  launchAtLogin: boolean
  translationLanguage: TargetLanguage | null
  analyticsEnabled: boolean
  reviewReminders: ReviewReminderSettings
  notificationsSupported: boolean
}

let openFeedbackCallback: (() => void) | null = null
let openFeedbackPending = false

ipcRenderer.on('open-feedback', () => {
  if (openFeedbackCallback) openFeedbackCallback()
  else openFeedbackPending = true
})

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
  getAnalyticsSessionId: () => ipcRenderer.invoke('get-analytics-session-id'),
  setSettings: (partial: Partial<AppSettings>) => ipcRenderer.invoke('set-settings', partial),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (word: string) => ipcRenderer.invoke('add-history', word),
  removeHistory: (word: string) => ipcRenderer.invoke('remove-history', word),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  readLookupCache: (query: string) => ipcRenderer.invoke('read-lookup-cache', query),
  writeLookupCache: (input: LookupCacheWrite) => ipcRenderer.invoke('write-lookup-cache', input),
  clearLookupCache: () => ipcRenderer.invoke('clear-lookup-cache'),
  exportSavedWordsCsv: (csv: string) => ipcRenderer.invoke('export-saved-words-csv', csv),
  onReminderDueCountRequest: (callback: (nonce: string) => void) => {
    const listener = (_event: IpcRendererEvent, nonce: string) => callback(nonce)
    ipcRenderer.on('request-reminder-due-count', listener)
    return () => ipcRenderer.removeListener('request-reminder-due-count', listener)
  },
  sendReminderDueCount: (nonce: string, count: number) => {
    ipcRenderer.send('reminder-due-count-response', nonce, count)
  },
  getSpellingSuggestions: (word: string) => {
    const value = typeof word === 'string' ? word.trim().slice(0, 160) : ''
    if (!value || /\s/.test(value)) return []
    return webFrame.getWordSuggestions(value).slice(0, 5)
  },
  recordLookupSuccess: () => ipcRenderer.invoke('record-lookup-success'),
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
  onOpenFeedback: (callback: () => void) => {
    openFeedbackCallback = callback
    if (openFeedbackPending) {
      openFeedbackPending = false
      queueMicrotask(callback)
    }
    return () => {
      if (openFeedbackCallback === callback) openFeedbackCallback = null
    }
  },
  changeHotkey: (accelerator: string) => ipcRenderer.invoke('change-hotkey', accelerator),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
})
