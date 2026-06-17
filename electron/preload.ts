import { contextBridge, ipcRenderer } from 'electron'

type AppSettings = {
  hotkey: string
  stands4Uid: string
  stands4Token: string
  launchAtLogin: boolean
}

contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  setWindowHeight: (height: number) => ipcRenderer.send('set-window-height', height),
  onFocusSearch: (callback: () => void) => {
    ipcRenderer.on('focus-search', callback)
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (partial: Partial<AppSettings>) => ipcRenderer.invoke('set-settings', partial),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (word: string) => ipcRenderer.invoke('add-history', word),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getStands4Credentials: () => ipcRenderer.invoke('get-stands4-credentials'),
  openSettings: () => ipcRenderer.send('open-settings'),
  sendFeedback: () => ipcRenderer.send('send-feedback'),
})
