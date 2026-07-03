import type { DictionaryResult, IdiomResult, SearchResponse } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'
import { FreeDictionarySource } from './FreeDictionarySource'
import { IdiomSource } from './IdiomSource'
import { KrdictSource } from './KrdictSource'
import { EnKoTranslationSource } from './EnKoTranslationSource'
import { toUserError } from './DictionaryError'
import { containsHangul } from '../../utils/lang'

/**
 * Coordinates the dictionary sources. The query's script picks the direction:
 * Hangul goes to the Korean→English dictionary alone; everything else hits the
 * English pipeline (free dictionary, idioms for phrases) plus an optional
 * English→Korean translation augmentation that never delays or fails a result.
 */
export class DictionaryService {
  constructor(
    private free: DictionarySource<DictionaryResult[]>,
    private idiom: DictionarySource<IdiomResult>,
    private krdict: DictionarySource<DictionaryResult[]>,
    private enko: DictionarySource<string[]>
  ) {}

  async search(query: string): Promise<SearchResponse> {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      throw new Error('Empty query')
    }

    if (containsHangul(trimmedQuery)) {
      try {
        const results = await this.krdict.lookup(trimmedQuery)
        return { dictionaryResults: results, idiomResult: null, koTranslations: null, source: 'krdict' }
      } catch (error) {
        throw toUserError(error, `"${trimmedQuery}" not found`)
      }
    }

    const isMultiWord = trimmedQuery.includes(' ')

    if (!isMultiWord) {
      const [dictResult, koResult] = await Promise.allSettled([
        this.free.lookup(trimmedQuery),
        this.enko.lookup(trimmedQuery),
      ])
      if (dictResult.status === 'rejected') {
        throw toUserError(dictResult.reason, `"${trimmedQuery}" not found`)
      }
      return {
        dictionaryResults: dictResult.value,
        idiomResult: null,
        koTranslations: normalizeKo(koResult),
        source: 'free-dictionary',
      }
    }

    // Multi-word — try the English sources in parallel; en→ko rides along.
    const [dictResult, idiomResult, koResult] = await Promise.allSettled([
      this.free.lookup(trimmedQuery),
      this.idiom.lookup(trimmedQuery),
      this.enko.lookup(trimmedQuery),
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
      koTranslations: normalizeKo(koResult),
      source: hasDict && hasIdiom ? 'both' : hasDict ? 'free-dictionary' : 'phrases-api',
    }
  }
}

/** An empty or failed en→ko lookup is simply "no translations". */
function normalizeKo(result: PromiseSettledResult<string[]>): string[] | null {
  return result.status === 'fulfilled' && result.value.length > 0 ? result.value : null
}

/** App-wide instance wired to the real sources. */
export const dictionaryService = new DictionaryService(
  new FreeDictionarySource(),
  new IdiomSource(),
  new KrdictSource(),
  new EnKoTranslationSource()
)
