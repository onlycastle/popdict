import type { DictionaryResult, SearchSource } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'
import { DictionaryError } from './DictionaryError'

const FREE_DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en'

/** Free Dictionary API — single-word definitions. */
export class FreeDictionarySource implements DictionarySource<DictionaryResult[]> {
  readonly name: SearchSource = 'free-dictionary'

  async lookup(word: string): Promise<DictionaryResult[]> {
    let response: Response
    try {
      response = await fetch(`${FREE_DICTIONARY_API}/${encodeURIComponent(word)}`)
    } catch {
      // fetch only rejects on network-level failures (offline, DNS, CORS).
      throw new DictionaryError('network')
    }

    if (response.status === 404) throw new DictionaryError('not-found')
    if (!response.ok) throw new DictionaryError('service')

    return response.json()
  }
}
