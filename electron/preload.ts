import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  setWindowHeight: (height: number) => ipcRenderer.send('set-window-height', height),
  onFocusSearch: (callback: () => void) => {
    ipcRenderer.on('focus-search', callback)
  }
})

// Type definitions for TypeScript
export interface IElectronAPI {
  hideWindow: () => void
  setWindowHeight: (height: number) => void
  onFocusSearch: (callback: () => void) => void
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
