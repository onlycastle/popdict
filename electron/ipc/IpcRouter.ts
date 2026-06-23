/* eslint-disable @typescript-eslint/no-explicit-any */
import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { createLogger } from '../../shared/logger'

const log = createLogger('IPC')

// `any[]` mirrors Electron's own ipcMain listener typings so concrete handlers
// like (_e, word: string) assign cleanly.
type InvokeHandler = (event: IpcMainInvokeEvent, ...args: any[]) => unknown
type SendHandler = (event: IpcMainEvent, ...args: any[]) => void

/**
 * Thin registry over ipcMain. Its one value-add over raw ipcMain.handle is
 * uniform failure logging on invoke handlers — logged then rethrown, so the
 * renderer still sees the rejection (e.g. open-external-url's https guard).
 */
export class IpcRouter {
  /** Request/response handler (renderer ipcRenderer.invoke). */
  handle(channel: string, handler: InvokeHandler): this {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        return await handler(event, ...args)
      } catch (error) {
        log.event(`${channel} failed`, {
          message: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    })
    return this
  }

  /** Fire-and-forget listener (renderer ipcRenderer.send). */
  on(channel: string, handler: SendHandler): this {
    ipcMain.on(channel, handler)
    return this
  }
}
