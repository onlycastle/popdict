import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictionaryResult, SearchSource } from '../../types/dictionary'
import { publicSupabase } from '../supabaseClient'
import type { DictionarySource } from './DictionarySource'
import { DictionaryError } from './DictionaryError'

type PhraseRow = {
  phrase: unknown
  part_of_speech: unknown
  sense_rank: unknown
  definition: unknown
  example: unknown
  synonyms: unknown
  antonyms: unknown
  usage_labels: unknown
  source_url: unknown
  license_name: unknown
  license_url: unknown
}

export function normalizePhraseQuery(value: string): string {
  return value
    .normalize('NFKC')
    .replaceAll('’', "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“”'‘’.,!?;:()[\]{}]+|["“”'‘’.,!?;:()[\]{}]+$/g, '')
    .trim()
    .toLowerCase()
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function phraseRowsToResults(rows: PhraseRow[]): DictionaryResult[] {
  const valid = rows.filter((row) =>
    typeof row.phrase === 'string' &&
    typeof row.part_of_speech === 'string' &&
    typeof row.definition === 'string'
  )
  if (valid.length === 0) return []
  const first = valid[0]
  return [{
    word: first.phrase as string,
    meanings: valid.map((row) => ({
      partOfSpeech: row.part_of_speech as string,
      definitions: [{
        definition: row.definition as string,
        example: typeof row.example === 'string' ? row.example : undefined,
        synonyms: strings(row.synonyms),
        antonyms: strings(row.antonyms),
        usageLabels: strings(row.usage_labels),
      }],
    })),
    sourceUrls: typeof first.source_url === 'string' ? [first.source_url] : undefined,
    license: typeof first.license_name === 'string' && typeof first.license_url === 'string'
      ? { name: first.license_name, url: first.license_url }
      : undefined,
  }]
}

export class KaikkiPhraseSource implements DictionarySource<DictionaryResult[]> {
  readonly name: SearchSource = 'kaikki-phrases'

  constructor(private client: SupabaseClient | null = publicSupabase) {}

  async lookup(query: string): Promise<DictionaryResult[]> {
    if (!this.client) throw new DictionaryError('service')
    const normalized = normalizePhraseQuery(query)
    if (!normalized || !normalized.includes(' ')) throw new DictionaryError('not-found')

    let result
    try {
      result = await this.client
        .from('phrase_entries')
        .select('phrase, part_of_speech, sense_rank, definition, example, synonyms, antonyms, usage_labels, source_url, license_name, license_url')
        .eq('normalized_phrase', normalized)
        .order('sense_rank', { ascending: true })
        .limit(3)
    } catch {
      throw new DictionaryError('network')
    }
    if (result.error) throw new DictionaryError('service')
    const rows = (result.data ?? []) as PhraseRow[]
    if (rows.length === 0) throw new DictionaryError('not-found')

    const results = phraseRowsToResults(rows)
    if (results.length === 0) throw new DictionaryError('service')
    return results
  }
}
