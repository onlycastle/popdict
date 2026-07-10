import type { DictionaryResult, IdiomResult, SearchResponse } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'
import { FreeDictionarySource } from './FreeDictionarySource'
import { IdiomSource } from './IdiomSource'
import { toUserError } from './DictionaryError'

/**
 * Coordinates the dictionary sources: single words go to the free dictionary
 * alone; multi-word queries also try the idiom source in parallel and merge
 * whatever succeeds.
 */
export class DictionaryService {
  constructor(
    private free: DictionarySource<DictionaryResult[]>,
    private idiom: DictionarySource<IdiomResult>
  ) {}

  async search(query: string): Promise<SearchResponse> {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      throw new Error('Empty query')
    }

    const isMultiWord = trimmedQuery.includes(' ')

    if (!isMultiWord) {
      try {
        const results = await this.free.lookup(trimmedQuery)
        return { dictionaryResults: results, idiomResult: null, source: 'free-dictionary' }
      } catch (error) {
        throw toUserError(error, `"${trimmedQuery}" not found`)
      }
    }

    // Multi-word — try the English sources in parallel.
    const [dictResult, idiomResult] = await Promise.allSettled([
      this.free.lookup(trimmedQuery),
      this.idiom.lookup(trimmedQuery),
    ])

    const hasDict = dictResult.status === 'fulfilled'
    const hasIdiom = idiomResult.status === 'fulfilled'

    if (!hasDict && !hasIdiom) {
      // If the dictionary call failed on the network, say so rather than
      // pretending the word doesn't exist.
      if (dictResult.status === 'rejected') {
        throw toUserError(dictResult.reason, `No results found for "${trimmedQuery}"`)
      }
      throw new Error(`No results found for "${trimmedQuery}"`)
    }

    return {
      dictionaryResults: hasDict ? dictResult.value : null,
      idiomResult: hasIdiom ? idiomResult.value : null,
      source: hasDict && hasIdiom ? 'both' : hasDict ? 'free-dictionary' : 'phrases-api',
    }
  }
}

/** App-wide instance wired to the real sources. */
export const dictionaryService = new DictionaryService(new FreeDictionarySource(), new IdiomSource())
