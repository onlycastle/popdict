import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictionaryResult, SearchSource } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'
import { DictionaryError } from './DictionaryError'
import { supabase } from '../supabaseClient'

/**
 * Korean→English lookup via the Supabase Edge Function proxy. The krdict API
 * key lives server-side in the function (never bundled in the app), and the
 * function caches results and rate-limits per IP — same pattern as IdiomSource.
 */
export class KrdictSource implements DictionarySource<DictionaryResult[]> {
  readonly name: SearchSource = 'krdict'

  constructor(private client: SupabaseClient | null = supabase) {}

  async lookup(word: string): Promise<DictionaryResult[]> {
    if (!this.client) {
      throw new DictionaryError('service', 'Korean dictionary is not configured')
    }

    const { data, error } = await this.client.functions.invoke('krdict', {
      body: { word },
    })

    if (error) {
      // supabase-js throws FunctionsFetchError when the function was never
      // reached (offline/DNS) — everything else is a server-side failure.
      throw new DictionaryError(error.name === 'FunctionsFetchError' ? 'network' : 'service')
    }

    const results = (data?.results ?? []) as DictionaryResult[]
    if (results.length === 0) {
      throw new DictionaryError('not-found')
    }
    return results
  }
}
