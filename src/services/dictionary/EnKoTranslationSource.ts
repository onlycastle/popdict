import type { SupabaseClient } from '@supabase/supabase-js'
import type { SearchSource } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'
import { supabase } from '../supabaseClient'

/**
 * English→Korean translations from the Wiktionary-derived en_ko_translations
 * table. This augments English results and must never delay or break them, so
 * every failure path resolves to [] instead of throwing.
 */
export class EnKoTranslationSource implements DictionarySource<string[]> {
  readonly name: SearchSource = 'en-ko'

  constructor(private client: SupabaseClient | null = supabase) {}

  async lookup(word: string): Promise<string[]> {
    if (!this.client) return []
    try {
      const { data, error } = await this.client
        .from('en_ko_translations')
        .select('ko')
        .eq('word', word.toLowerCase())
        .maybeSingle()
      if (error || !data?.ko?.length) return []
      return data.ko
    } catch {
      return []
    }
  }
}
