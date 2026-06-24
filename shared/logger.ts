// Tiny tagged debug logger shared by the main and renderer processes.
//
// Replaces three independent re-implementations of the same "prefix +
// JSON.stringify + try/catch" pattern (authDebug in the main process,
// authDebug in useSupabaseAuth, savedWordsDebug in savedWords). Lives in
// shared/ because it uses only `console` + JSON, which exist in both the
// Electron main (Node) and renderer (browser) runtimes.

export type LogDetails = Record<string, unknown>

export type Logger = {
  /** Emit `[tag] name {details}`. Never throws, even on unserializable details. */
  event(name: string, details?: LogDetails): void
}

/** Stringify details defensively — a circular object must not crash a log call. */
export function safeStringify(details?: LogDetails): string {
  if (!details) return ''
  try {
    return JSON.stringify(details)
  } catch {
    return '[unserializable details]'
  }
}

export function createLogger(tag: string): Logger {
  return {
    event(name, details) {
      console.info(`[${tag}] ${name} ${safeStringify(details)}`.trim())
    },
  }
}
