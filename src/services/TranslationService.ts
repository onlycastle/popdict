import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizeEnglishWord,
  type TargetLanguage,
  type WordTranslation,
} from '../../shared/language'
import { supabase } from './supabaseClient'

type TranslationRow = {
  translation: unknown
  sense_label: unknown
  rank: unknown
}

export class TranslationLookupError extends Error {
  constructor() {
    super('Translations are temporarily unavailable')
    this.name = 'TranslationLookupError'
  }
}

export class TranslationService {
  constructor(private client: SupabaseClient | null = supabase) {}

  async lookup(word: string, language: TargetLanguage): Promise<WordTranslation[]> {
    const normalizedWord = normalizeEnglishWord(word)
    if (!this.client || !normalizedWord) return []

    const { data, error } = await this.client
      .from('word_translations')
      .select('translation, sense_label, rank')
      .eq('normalized_word', normalizedWord)
      .eq('language_code', language)
      .order('rank', { ascending: true })
      .limit(3)

    if (error) throw new TranslationLookupError()

    return ((data ?? []) as TranslationRow[]).flatMap((row) => {
      if (
        typeof row.translation !== 'string' ||
        !row.translation.trim() ||
        !Number.isInteger(row.rank) ||
        (row.rank as number) < 1 ||
        (row.rank as number) > 3 ||
        (row.sense_label !== null && typeof row.sense_label !== 'string')
      ) {
        return []
      }
      return [{
        text: row.translation,
        senseLabel: row.sense_label as string | null,
        rank: row.rank as number,
      }]
    })
  }
}

export const translationService = new TranslationService()
