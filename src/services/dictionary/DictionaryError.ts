import type { LookupFailure, LookupFailureKind } from '../../types/dictionary'

/** Typed lookup failure so the UI can tell "offline" apart from "no such word". */
export class DictionaryError extends Error {
  constructor(public kind: LookupFailureKind, message?: string) {
    super(message ?? kind)
    this.name = 'DictionaryError'
  }
}

export function toLookupFailure(error: unknown, query: string): LookupFailure {
  const kind = error instanceof DictionaryError ? error.kind : 'service'
  const phrase = /\s/.test(query.trim())
  const message = kind === 'network'
    ? 'No connection — check your internet and try again.'
    : kind === 'service'
      ? 'Dictionary service is unavailable. Try again shortly.'
      : phrase
        ? `No results found for "${query}"`
        : `"${query}" not found`
  return { kind, message, query }
}
