import { randomUUID } from 'node:crypto'
import type { BrowserWindow, WebContents } from 'electron'

type Pending = {
  senderId: number
  resolve: (count: number) => void
  timer: ReturnType<typeof setTimeout>
}

/** Main-issued nonce exchange; renderer replies are accepted only from the requested window. */
export class DueCountBroker {
  private pending = new Map<string, Pending>()

  request(window: BrowserWindow | null, timeoutMs = 10_000): Promise<number> {
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return Promise.resolve(0)
    const nonce = randomUUID()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(nonce)
        resolve(0)
      }, timeoutMs)
      this.pending.set(nonce, { senderId: window.webContents.id, resolve, timer })
      window.webContents.send('request-reminder-due-count', nonce)
    })
  }

  resolve(sender: WebContents, nonce: unknown, count: unknown): boolean {
    if (typeof nonce !== 'string' || !Number.isInteger(count)) return false
    const pending = this.pending.get(nonce)
    if (!pending || pending.senderId !== sender.id) return false
    this.pending.delete(nonce)
    clearTimeout(pending.timer)
    pending.resolve(Math.max(0, Math.min(count as number, 10_000)))
    return true
  }

  clear(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.resolve(0)
    }
    this.pending.clear()
  }
}
