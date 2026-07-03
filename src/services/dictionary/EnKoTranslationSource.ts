import type { SupabaseClient } from '@supabase/supabase-js'
import type { SearchSource } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'
import { supabase } from '../supabaseClient'

const LOOKUP_TIMEOUT_MS = 1500

/**
 * English→Korean translations from the Wiktionary-derived en_ko_translations
 * table. This augments English results and must never delay or break them, so
 * lookup never throws AND never hangs: every failure path resolves to [] and
 * the query is bounded at 1500ms, after which [] is returned.
 */
export class EnKoTranslationSource implements DictionarySource<string[]> {
  readonly name: SearchSource = 'en-ko'

  constructor(private client: SupabaseClient | null = supabase) {}

  async lookup(word: string): Promise<string[]> {
    if (!this.client) return []
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<string[]>((resolve) => {
        timer = setTimeout(() => resolve([]), LOOKUP_TIMEOUT_MS)
      })
      return await Promise.race([this.query(word), timeout])
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }

  private async query(word: string): Promise<string[]> {
    const { data, error } = await this.client!
      .from('en_ko_translations')
      .select('ko')
      .eq('word', word.toLowerCase())
      .maybeSingle()
    if (error || !data?.ko?.length) return []
    return data.ko
  }
}
