export type DictionaryErrorKind = 'network' | 'not-found' | 'service'

/** Typed lookup failure so the UI can tell "offline" apart from "no such word". */
export class DictionaryError extends Error {
  constructor(public kind: DictionaryErrorKind, message?: string) {
    super(message ?? kind)
    this.name = 'DictionaryError'
  }
}

/** Map a thrown error to a user-facing message; `notFoundMessage` is the default. */
export function toUserError(error: unknown, notFoundMessage: string): Error {
  if (error instanceof DictionaryError) {
    if (error.kind === 'network') {
      return new Error('No connection — check your internet and try again.')
    }
    if (error.kind === 'service') {
      return new Error('Dictionary service is unavailable. Try again shortly.')
    }
  }
  return new Error(notFoundMessage)
}
