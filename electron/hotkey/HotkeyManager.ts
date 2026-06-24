import { globalShortcut } from 'electron'

/**
 * Owns the single global hotkey registration — the binding between an OS
 * accelerator and the app action. Callers deal only in accelerator strings.
 */
export class HotkeyManager {
  constructor(private onTrigger: () => void) {}

  /** Register `accelerator`, replacing any prior one. Returns whether it took. */
  register(accelerator: string): boolean {
    globalShortcut.unregisterAll()
    try {
      const ok = globalShortcut.register(accelerator, this.onTrigger)
      return ok && globalShortcut.isRegistered(accelerator)
    } catch {
      return false
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }
}
