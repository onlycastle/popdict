export type LookupSelectionKind = 'recovery' | 'related'

type LookupSelectionDeps = {
  setQuery: (word: string) => void
  focusSearch: () => void
  trackRecovery: () => void
}

export function handleLookupSelection(
  kind: LookupSelectionKind,
  word: string,
  deps: LookupSelectionDeps,
): void {
  if (kind === 'recovery') deps.trackRecovery()
  deps.setQuery(word)
  deps.focusSearch()
}
