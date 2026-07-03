import { app, autoUpdater } from 'electron'

// Auto-update via the free update.electronjs.org service (the same feed that
// `update-electron-app` wraps), using Electron's built-in Squirrel.Mac updater
// so we add no dependencies.
//
// PREREQUISITES before this does anything:
//   1. The GitHub repo must be PUBLIC.
//   2. Releases must include a macOS .zip asset (added via MakerZIP in
//      forge.config.ts) whose name carries the arch, e.g.
//      `PopDict-darwin-arm64-<version>.zip`, so the service serves the right one.
//   3. Build with POPDICT_GITHUB_REPO=owner/repo (baked in via vite.main.config).
// Until that env var is set at build time, auto-update is disabled (safe no-op).

/** The subset of Electron's autoUpdater this manager uses — injectable for tests. */
export interface AutoUpdaterLike {
  setFeedURL(options: { url: string }): void
  checkForUpdates(): void
  quitAndInstall(): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (...args: any[]) => void): unknown
}

export type ManualCheckResult = 'up-to-date' | 'error'

export interface UpdateManagerHooks {
  /** An update finished downloading — tell the user (notification + tray item). */
  onUpdateReady: (version: string) => void
  /** Outcome of a user-initiated check; background outcomes never reach this. */
  onManualCheckResult: (result: ManualCheckResult) => void
}

export interface UpdateManagerDeps extends UpdateManagerHooks {
  updater: AutoUpdaterLike
  isPackaged: boolean
  platform: NodeJS.Platform
  version: string
  repo: string
  intervalMs?: number
}

const SIX_HOURS = 1000 * 60 * 60 * 6

/**
 * Owns the auto-update lifecycle: silent background checks stay silent, and a
 * manual "Check for Updates…" routes exactly one outcome back to the user.
 */
export class UpdateManager {
  private readyVersion: string | null = null
  private manualCheckPending = false
  private enabled = false

  constructor(private deps: UpdateManagerDeps) {}

  /** Version of a fully-downloaded update, '' if its name was unknown, null if none. */
  get updateReadyVersion(): string | null {
    return this.readyVersion
  }

  /** Wire the feed and listeners, then start checking. False = disabled (dev, non-mac, unconfigured). */
  init(): boolean {
    const { updater, isPackaged, platform, version, repo } = this.deps
    if (!isPackaged) return false // never check in dev
    if (platform !== 'darwin') return false // wired for the macOS release only
    if (!repo) return false // not configured yet

    try {
      updater.setFeedURL({ url: `https://update.electronjs.org/${repo}/${platform}/${version}` })
    } catch (error) {
      console.error('autoUpdater.setFeedURL failed:', error)
      return false
    }

    updater.on('update-downloaded', (_event: unknown, _notes: unknown, releaseName: unknown) => {
      // update.electronjs.org names releases by tag ("v1.2.0") — strip the v
      // so UI labels can add their own prefix without doubling it.
      this.readyVersion = String(releaseName ?? '').replace(/^v/i, '')
      this.manualCheckPending = false
      this.deps.onUpdateReady(this.readyVersion)
    })

    updater.on('update-not-available', () => {
      if (!this.manualCheckPending) return
      this.manualCheckPending = false
      this.deps.onManualCheckResult('up-to-date')
    })

    updater.on('error', (error: unknown) => {
      console.error('autoUpdater error:', error)
      if (!this.manualCheckPending) return
      this.manualCheckPending = false
      this.deps.onManualCheckResult('error')
    })

    this.enabled = true
    this.check()
    setInterval(() => this.check(), this.deps.intervalMs ?? SIX_HOURS)
    return true
  }

  /** Tray "Check for Updates…" — unlike background checks, its outcome is surfaced. */
  checkNow(): void {
    if (!this.enabled) {
      this.deps.onManualCheckResult('error')
      return
    }
    if (this.readyVersion !== null) {
      // Already staged; re-surface the prompt rather than re-checking (Squirrel
      // won't re-download a staged update anyway).
      this.deps.onUpdateReady(this.readyVersion)
      return
    }
    this.manualCheckPending = true
    this.check()
  }

  /** Restart onto the downloaded update. */
  installUpdate(): void {
    try {
      this.deps.updater.quitAndInstall()
    } catch (error) {
      console.error('autoUpdater.quitAndInstall failed:', error)
    }
  }

  private check(): void {
    try {
      this.deps.updater.checkForUpdates()
    } catch (error) {
      console.error('autoUpdater.checkForUpdates failed:', error)
      // A synchronous throw never reaches the 'error' event listener — resolve
      // a pending manual check here so the user's click always gets an answer.
      if (this.manualCheckPending) {
        this.manualCheckPending = false
        this.deps.onManualCheckResult('error')
      }
    }
  }
}

/** App-wide instance wired to the real Electron autoUpdater. */
export function createUpdateManager(hooks: UpdateManagerHooks): UpdateManager {
  return new UpdateManager({
    updater: autoUpdater,
    isPackaged: app.isPackaged,
    platform: process.platform,
    version: app.getVersion(),
    repo: process.env.POPDICT_GITHUB_REPO || '',
    ...hooks,
  })
}

/** TEMPORARY back-compat shim so main.ts keeps compiling until Task 2 rewires it. */
export function initAutoUpdates(): void {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  createUpdateManager({ onUpdateReady: () => {}, onManualCheckResult: () => {} }).init()
}
