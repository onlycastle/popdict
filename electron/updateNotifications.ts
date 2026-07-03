import { app, dialog, Notification } from 'electron'
import type { ManualCheckResult } from './updater'

// User-facing update messages. Background outcomes use non-interruptive
// notifications; anything shown IN RESPONSE to the user clicking
// "Check for Updates…" is a dialog. The tray "Restart to Update" item is set
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

/** Dialog response to a user-initiated check: up to date, or check failed. */
export async function showManualCheckResultDialog(
  result: ManualCheckResult,
  currentVersion: string
): Promise<void> {
  app.focus({ steal: true }) // LSUIElement app: dialogs don't take focus on their own
  await dialog.showMessageBox({
    type: result === 'up-to-date' ? 'info' : 'warning',
    message: result === 'up-to-date' ? 'PopDict is up to date' : 'Update check failed',
    detail:
      result === 'up-to-date'
        ? `You're on the latest version (v${currentVersion}).`
        : 'Could not reach the update server. Try again later.',
    buttons: ['OK'],
  })
}

/** Dialog response when a manual check finds an update already downloaded. */
export async function showUpdateReadyDialog(version: string, install: () => void): Promise<void> {
  app.focus({ steal: true })
  const { response } = await dialog.showMessageBox({
    type: 'info',
    message: 'PopDict update ready',
    detail: version
      ? `Version ${version} has been downloaded. Restart now to update?`
      : 'A new version has been downloaded. Restart now to update?',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response === 0) install()
}
