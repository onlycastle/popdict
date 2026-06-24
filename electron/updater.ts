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
const GITHUB_REPO = process.env.POPDICT_GITHUB_REPO || ''

const SIX_HOURS = 1000 * 60 * 60 * 6

export function initAutoUpdates(): void {
  if (!app.isPackaged) return // never check in dev
  if (process.platform !== 'darwin') return // wired for the macOS release only
  if (!GITHUB_REPO) return // not configured yet

  const feedURL = `https://update.electronjs.org/${GITHUB_REPO}/${process.platform}/${app.getVersion()}`

  try {
    autoUpdater.setFeedURL({ url: feedURL })
  } catch (error) {
    console.error('autoUpdater.setFeedURL failed:', error)
    return
  }

  autoUpdater.on('error', (error) => {
    console.error('autoUpdater error:', error)
  })

  const check = () => {
    try {
      autoUpdater.checkForUpdates()
    } catch (error) {
      console.error('autoUpdater.checkForUpdates failed:', error)
    }
  }

  check()
  setInterval(check, SIX_HOURS)
}
