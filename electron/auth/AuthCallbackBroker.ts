import { app, BrowserWindow } from 'electron'
import type { Logger } from '../../shared/logger'
import { describeAuthUrl, isAuthCallbackUrl } from '../../shared/authUrl'
import type { WindowManager } from '../windows/WindowManager'

/**
 * Owns the OAuth deep-link callback state machine: which callback URL is
 * pending, whether it's been delivered, and which window opened the external
 * browser. Replaces the loose `pending/delivered/target` module variables and
 * the handleAuthCallback/dispatchPendingAuthCallback functions in main.ts.
 */
export class AuthCallbackBroker {
  private pending: string | null = null
  private delivered: string | null = null
  private target: BrowserWindow | null = null

  constructor(private windows: WindowManager, private log: Logger) {}

  get hasPending(): boolean {
    return this.pending !== null
  }

  /** Validate + store an inbound deep-link callback, then try to deliver it. */
  receive(url: string): void {
    if (!isAuthCallbackUrl(url)) {
      this.log.event('ignore non-auth callback url', describeAuthUrl(url))
      return
    }
    this.log.event('received auth callback', describeAuthUrl(url))
    this.pending = url
    this.delivered = null

    if (!app.isReady()) {
      this.log.event('app not ready; callback stored')
      return
    }
    this.dispatch()
  }

  /** Remember which window initiated the external-browser sign-in. */
  setTarget(win: BrowserWindow | null): void {
    this.target = win
  }

  /** Renderer pulls (and clears) the pending callback URL. */
  consume(): string | null {
    const callbackUrl = this.pending
    this.log.event('renderer consumed callback', {
      hasCallback: Boolean(callbackUrl),
      ...(callbackUrl ? describeAuthUrl(callbackUrl) : {}),
    })
    this.pending = null
    this.delivered = null
    this.target = null
    return callbackUrl
  }

  /** Deliver the pending callback to the best available window, once it's ready. */
  dispatch(): void {
    if (!this.pending) return
    if (this.delivered === this.pending) {
      this.log.event('skip duplicate callback delivery')
      return
    }

    const target = this.resolveTarget()
    if (!target || target.webContents.isDestroyed()) {
      this.log.event('callback pending but no target window')
      return
    }

    if (target.webContents.isLoading()) {
      this.log.event('callback target loading; waiting')
      target.webContents.once('did-finish-load', () => this.dispatch())
      return
    }

    this.log.event('deliver callback to renderer', describeAuthUrl(this.pending))
    target.webContents.send('auth-callback', this.pending)
    this.delivered = this.pending

    if (target.isMinimized()) target.restore()
    target.show()
    target.focus()
  }

  /** Prefer the window that opened the browser, else settings, else search. */
  private resolveTarget(): BrowserWindow | null {
    if (this.target && !this.target.webContents.isDestroyed()) return this.target
    return this.windows.get('settings') ?? this.windows.get('search')
  }
}
