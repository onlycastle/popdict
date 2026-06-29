import { clipboard, systemPreferences } from 'electron'
import { execFile } from 'node:child_process'
import { sanitizeSelection } from './selection'

// --- Select-text → instant lookup (macOS) -------------------------------
// Sentinel written to the clipboard so we can tell whether ⌘C actually
// produced a copy (vs. there being no selection / the copy not landing).
const SELECTION_PROBE = '__POPDICT_SELECTION_PROBE__'

// Poll cadence and bounds. The copy is re-sent once at RETRY_AT (see below);
// DEADLINE leaves room for that second attempt to land before we give up.
const POLL_INTERVAL_MS = 25
const RETRY_AT_MS = 120
const DEADLINE_MS = 350

const COPY_SCRIPT = 'tell application "System Events" to keystroke "c" using command down'

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

    let settled = false
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      clipboard.writeText(previousClipboard) // restore the user's clipboard
      resolve(value)
    }

    const sendCopy = (onError?: (error: Error | null) => void) =>
      execFile('osascript', ['-e', COPY_SCRIPT], (error) => onError?.(error))

    // First attempt. If osascript itself fails (e.g. Automation permission not
    // granted), give up immediately.
    sendCopy((error) => {
      if (error) finish(null)
    })

    // The hotkey that triggered us is ⌘⇧Space, so ⌘ and ⇧ can still be held
    // when the first ⌘C is posted — macOS may then read it as ⌘⇧C, which does
    // not copy. We re-send ⌘C once after a short beat (modifiers released by
    // then), so a held-modifier first attempt self-corrects without making the
    // common already-released case any slower.
    const start = Date.now()
    let retried = false
    const poll = () => {
      if (settled) return
      const current = clipboard.readText()
      if (current !== SELECTION_PROBE) return finish(sanitizeSelection(current))

      const elapsed = Date.now() - start
      if (!retried && elapsed >= RETRY_AT_MS) {
        retried = true
        sendCopy()
      }
      if (elapsed > DEADLINE_MS) return finish(null)
      setTimeout(poll, POLL_INTERVAL_MS)
    }
    setTimeout(poll, POLL_INTERVAL_MS)
  })
}
