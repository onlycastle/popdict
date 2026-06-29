import { app, BrowserWindow } from 'electron'
import type { Logger } from '../../shared/logger'
import { describeAuthUrl, isAuthCallbackUrl } from '../../shared/authUrl'
import type { WindowManager } from '../windows/WindowManager'

// How long after the app opens the OAuth browser a callback is still accepted.
const AUTH_INITIATION_WINDOW_MS = 5 * 60 * 1000

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
  private initiatedAt = 0

  constructor(
    private windows: WindowManager,
    private log: Logger,
    private now: () => number = () => Date.now()
  ) {}

  /** Record that the app just opened the OAuth browser (gates inbound callbacks). */
  markAuthInitiated(): void {
    this.initiatedAt = this.now()
  }

  get hasPending(): boolean {
    return this.pending !== null
  }

  /** Validate + store an inbound deep-link callback, then try to deliver it. */
  receive(url: string): void {
    if (!isAuthCallbackUrl(url)) {
      this.log.event('ignore non-auth callback url', describeAuthUrl(url))
      return
    }
    // Intentional security gate: drop callbacks that arrive without a recent
    // in-process markAuthInitiated(). This deliberately drops cold-start /
    // app-not-running callbacks as well. Do NOT weaken this gate to "fix" the
    // cold-start case — receiving a deep-link before the user explicitly signed
    // in is a confused-deputy attack surface.
    if (this.now() - this.initiatedAt > AUTH_INITIATION_WINDOW_MS) {
      this.log.event('ignore callback without recent auth initiation', describeAuthUrl(url))
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
    this.initiatedAt = 0
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
