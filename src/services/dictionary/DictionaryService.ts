import type { DictionaryResult, SearchResponse } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'
import { FreeDictionarySource } from './FreeDictionarySource'
import { DictionaryError } from './DictionaryError'
import { KaikkiPhraseSource } from './KaikkiPhraseSource'

/** Resolves English definitions. Phrases follow the normal no-results path. */
export class DictionaryService {
  constructor(
    private free: DictionarySource<DictionaryResult[]>,
    private phrases: DictionarySource<DictionaryResult[]>
  ) {}

  async search(query: string): Promise<SearchResponse> {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      throw new Error('Empty query')
    }

    if (!/\s/.test(trimmedQuery)) {
      const results = await this.free.lookup(trimmedQuery)
      return { dictionaryResults: results, source: 'free-dictionary', provenance: 'live' }
    }

    const [free, phrases] = await Promise.allSettled([
      this.free.lookup(trimmedQuery),
      this.phrases.lookup(trimmedQuery),
    ])
    const freeResults = free.status === 'fulfilled' ? free.value : []
    const phraseResults = phrases.status === 'fulfilled' ? phrases.value : []
    if (freeResults.length > 0 || phraseResults.length > 0) {
      const primary = phraseResults[0] ?? freeResults[0]
      const audioSource = freeResults[0]
      const merged: DictionaryResult = {
        ...primary,
        phonetic: audioSource?.phonetic ?? primary.phonetic,
        phonetics: audioSource?.phonetics ?? primary.phonetics,
        meanings: [...phraseResults, ...freeResults].flatMap((result) => result.meanings),
        sourceUrls: [...new Set(
          [...phraseResults, ...freeResults].flatMap((result) => result.sourceUrls ?? [])
        )],
      }
      return {
        dictionaryResults: [merged],
        source: freeResults.length > 0 && phraseResults.length > 0
          ? 'combined'
          : freeResults.length > 0 ? 'free-dictionary' : 'kaikki-phrases',
        provenance: 'live',
      }
    }

    const failures = [free, phrases]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason)
    if (failures.every((error) => error instanceof DictionaryError && error.kind === 'not-found')) {
      throw new DictionaryError('not-found')
    }
    if (failures.some((error) => error instanceof DictionaryError && error.kind === 'network')) {
      throw new DictionaryError('network')
    }
    throw new DictionaryError('service')
  }
}

/** App-wide instance wired to the real sources. */
export const dictionaryService = new DictionaryService(
  new FreeDictionarySource(),
  new KaikkiPhraseSource()
)
