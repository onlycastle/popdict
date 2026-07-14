import type { DictionaryResult, SearchResponse } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'
import { FreeDictionarySource } from './FreeDictionarySource'
import { toUserError } from './DictionaryError'

/** Resolves English definitions. Phrases follow the normal no-results path. */
export class DictionaryService {
  constructor(private free: DictionarySource<DictionaryResult[]>) {}

  async search(query: string): Promise<SearchResponse> {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      throw new Error('Empty query')
    }

    try {
      const results = await this.free.lookup(trimmedQuery)
      return { dictionaryResults: results, source: 'free-dictionary' }
    } catch (error) {
      const fallback = trimmedQuery.includes(' ')
        ? `No results found for "${trimmedQuery}"`
        : `"${trimmedQuery}" not found`
      throw toUserError(error, fallback)
    }
  }
}

/** App-wide instance wired to the real sources. */
export const dictionaryService = new DictionaryService(new FreeDictionarySource())
