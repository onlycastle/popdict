import type { SearchSource } from '../../types/dictionary'

/**
 * A single dictionary/phrase lookup backend (Strategy). New sources — a
 * thesaurus, Wiktionary — implement this without touching the coordinator.
 */
export interface DictionarySource<T> {
  readonly name: SearchSource
  lookup(query: string): Promise<T>
}
