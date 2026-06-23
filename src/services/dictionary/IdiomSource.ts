import type { SupabaseClient } from '@supabase/supabase-js'
import type { IdiomResult, SearchSource } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'
import { supabase } from '../supabaseClient'

/**
 * Idiom/phrase lookup via the Supabase Edge Function proxy. The STANDS4 token
 * lives server-side in the function (never bundled in the app), and the
 * function caches results to protect the shared free-tier quota.
 */
export class IdiomSource implements DictionarySource<IdiomResult> {
  readonly name: SearchSource = 'phrases-api'

  constructor(private client: SupabaseClient | null = supabase) {}

  async lookup(phrase: string): Promise<IdiomResult> {
    if (!this.client) {
      throw new Error('Idiom lookup is not configured')
    }

    const { data, error } = await this.client.functions.invoke('idioms', {
      body: { phrase },
    })

    if (error) throw error
    if (!data?.result) {
      throw new Error('No idiom found')
    }

    return data.result as IdiomResult
  }
}
