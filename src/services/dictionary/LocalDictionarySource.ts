import type { DictionaryResult } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'
import { DictionaryError } from './DictionaryError'

export class LocalDictionarySource implements DictionarySource<DictionaryResult[]> {
  readonly name = 'local-dictionary' as const
  async lookup(query: string): Promise<DictionaryResult[]> {
    let results: DictionaryResult[]
    try { results = await window.electronAPI.lookupLocalDictionary(query) }
    catch { throw new DictionaryError('service', 'The local dictionary could not be opened.') }
    if (!results.length) throw new DictionaryError('not-found')
    return results
  }
}
