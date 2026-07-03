import { Notification } from 'electron'
import type { ManualCheckResult } from './updater'

// User-facing update messages. The tray "Restart to Update" item is set
// alongside every notification, so a denied/undelivered notification still
// leaves a visible path to the update.

/** "Update ready" toast; clicking it restarts onto the new version. */
export function notifyUpdateReady(version: string, install: () => void): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title: 'PopDict update ready',
    body: version
      ? `Version ${version} has been downloaded. Click to restart and update.`
      : 'A new version has been downloaded. Click to restart and update.',
  })
  notification.on('click', install)
  notification.show()
}

/** Outcome of a user-initiated "Check for Updates…" (background checks stay silent). */
export function notifyManualCheckResult(result: ManualCheckResult, currentVersion: string): void {
  if (!Notification.isSupported()) return
  const notification =
    result === 'up-to-date'
      ? new Notification({
          title: 'PopDict is up to date',
          body: `You're on the latest version (v${currentVersion}).`,
        })
      : new Notification({
          title: 'Update check failed',
          body: 'Could not reach the update server. Try again later.',
        })
  notification.show()
}
