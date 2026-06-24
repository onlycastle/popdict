import { clipboard, systemPreferences } from 'electron'
import { execFile } from 'node:child_process'
import { sanitizeSelection } from './selection'

// --- Select-text → instant lookup (macOS) -------------------------------
// Sentinel written to the clipboard so we can tell whether ⌘C actually
// produced a copy (vs. there being no selection / the copy not landing).
const SELECTION_PROBE = '__POPDICT_SELECTION_PROBE__'

/**
 * Capture the current selection from the frontmost app by synthesizing ⌘C,
 * preserving and restoring the user's existing clipboard. Returns null when
 * there is no usable selection, Accessibility isn't granted, or anything fails
 * — callers then fall back to manual typing. macOS only.
 */
export function captureSelection(): Promise<string | null> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin') return resolve(null)
    // Check (do not prompt) — prompting happens when the user enables the
    // feature in Settings, not on every hotkey press.
    if (!systemPreferences.isTrustedAccessibilityClient(false)) return resolve(null)

    const previousClipboard = clipboard.readText()
    clipboard.writeText(SELECTION_PROBE)

    const restore = () => clipboard.writeText(previousClipboard)

    execFile(
      'osascript',
      ['-e', 'tell application "System Events" to keystroke "c" using command down'],
      (error) => {
        if (error) {
          restore()
          return resolve(null)
        }
        const deadline = Date.now() + 300
        const poll = () => {
          const current = clipboard.readText()
          if (current !== SELECTION_PROBE) {
            restore()
            return resolve(sanitizeSelection(current))
          }
          if (Date.now() > deadline) {
            restore()
            return resolve(null)
          }
          setTimeout(poll, 25)
        }
        setTimeout(poll, 25)
      }
    )
  })
}
