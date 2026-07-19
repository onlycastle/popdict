import type { SupabaseClient, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { SearchSource } from '../types/dictionary'
import type {
  SavedWordDetails,
  SavedWordRecord,
  SavedWordReview,
  SavedWordTag,
} from '../types/savedWords'
import { isReviewDue, masteryForBox } from './savedWordFilters'
import { createLogger } from '../../shared/logger'

export type SaveWordInput = {
  source: SearchSource
  user: User
  word: string
  details?: SavedWordDetails | null
}

type SavedWordRow = {
  id: unknown
  word: unknown
  normalized_word: string
  source: unknown
  created_at: string
  updated_at: string
  part_of_speech: unknown
  definition: unknown
  example: unknown
  synonyms: unknown
  antonyms: unknown
  translation: unknown
  translation_language: unknown
  source_url: unknown
  license_name: unknown
  license_url: unknown
  details_updated_at: unknown
  note: unknown
}

type ReviewRow = { normalized_word: unknown; box: unknown; next_due_at: unknown; updated_at: unknown }
type TagRow = {
  id: unknown
  saved_word_id: unknown
  tag: unknown
  normalized_tag: unknown
  created_at: unknown
}

export type SavedWord = SavedWordRecord

type SupabaseErrorLike = {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
}

function toSupabaseErrorLike(error: unknown): SupabaseErrorLike | null {
  if (!error || typeof error !== 'object') return null
  return error as SupabaseErrorLike
}

/**
 * Data access for the `saved_words` table. The Supabase null-guard lives in one
 * place (requireClient) instead of being repeated in every method.
 */
export class SavedWordsRepository {
  private log = createLogger('SavedWords')

  constructor(
    private client: SupabaseClient | null,
    private now: () => Date = () => new Date()
  ) {}

  async save({ source, user, word, details }: SaveWordInput): Promise<void> {
    const client = this.requireClient()

    const trimmedWord = word.trim()
    if (!trimmedWord) {
      throw new Error('No word to save.')
    }

    this.log.event('save start', {
      word: trimmedWord,
      normalizedWord: trimmedWord.toLowerCase(),
      source,
      userIdPrefix: user.id.slice(0, 8),
    })

    const snapshot = details ? {
      part_of_speech: details.partOfSpeech,
      definition: details.definition,
      example: details.example,
      synonyms: details.synonyms,
      antonyms: details.antonyms,
      translation: details.translation,
      translation_language: details.translationLanguage,
      source_url: details.sourceUrl,
      license_name: details.licenseName,
      license_url: details.licenseUrl,
      details_updated_at: details.detailsUpdatedAt,
    } : {}
    const { error } = await client.from('saved_words').upsert(
      {
        normalized_word: trimmedWord.toLowerCase(),
        source,
        updated_at: new Date().toISOString(),
        user_id: user.id,
        word: trimmedWord,
        ...snapshot,
      },
      { onConflict: 'user_id,normalized_word' }
    )

    if (error) this.fail('save word', error)
    this.log.event('save success', {
      word: trimmedWord,
      userIdPrefix: user.id.slice(0, 8),
    })
  }

  async list(user: User): Promise<SavedWord[]> {
    const client = this.requireClient()

    const [savedResult, reviewResult, tagResult] = await Promise.all([
      client
        .from('saved_words')
        .select('id, word, normalized_word, source, created_at, updated_at, part_of_speech, definition, example, synonyms, antonyms, translation, translation_language, source_url, license_name, license_url, details_updated_at, note')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      client
        .from('word_reviews')
        .select('normalized_word, box, next_due_at, updated_at')
        .eq('user_id', user.id),
      client
        .from('saved_word_tags')
        .select('id, saved_word_id, tag, normalized_tag, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ])

    if (savedResult.error) this.fail('load saved words', savedResult.error)
    if (reviewResult.error) this.fail('load word reviews', reviewResult.error)
    if (tagResult.error) this.fail('load saved word tags', tagResult.error)
    const reviews = new Map<string, SavedWordReview>()
    for (const row of (reviewResult.data ?? []) as ReviewRow[]) {
      if (
        typeof row.normalized_word === 'string' && Number.isInteger(row.box) &&
        typeof row.next_due_at === 'string' && typeof row.updated_at === 'string'
      ) {
        reviews.set(row.normalized_word, {
          box: row.box as number,
          nextDueAt: row.next_due_at,
          updatedAt: row.updated_at,
        })
      }
    }
    const tagsByWord = new Map<string, SavedWordTag[]>()
    for (const row of (tagResult.data ?? []) as TagRow[]) {
      if (
        typeof row.id !== 'string' || typeof row.saved_word_id !== 'string' ||
        typeof row.tag !== 'string' || typeof row.normalized_tag !== 'string' ||
        typeof row.created_at !== 'string'
      ) continue
      const group = tagsByWord.get(row.saved_word_id) ?? []
      group.push({
        id: row.id,
        savedWordId: row.saved_word_id,
        tag: row.tag,
        normalizedTag: row.normalized_tag,
        createdAt: row.created_at,
      })
      tagsByWord.set(row.saved_word_id, group)
    }
    return ((savedResult.data ?? []) as SavedWordRow[]).flatMap((row) => {
      if (
        typeof row.id !== 'string' || typeof row.word !== 'string' ||
        typeof row.normalized_word !== 'string' || typeof row.created_at !== 'string' ||
        typeof row.updated_at !== 'string'
      ) return []
      const review = reviews.get(row.normalized_word) ?? null
      const definition = typeof row.definition === 'string' ? row.definition : null
      const details: SavedWordDetails | null = definition ? {
        partOfSpeech: typeof row.part_of_speech === 'string' ? row.part_of_speech : null,
        definition,
        example: typeof row.example === 'string' ? row.example : null,
        synonyms: Array.isArray(row.synonyms)
          ? row.synonyms.filter((item): item is string => typeof item === 'string') : [],
        antonyms: Array.isArray(row.antonyms)
          ? row.antonyms.filter((item): item is string => typeof item === 'string') : [],
        translation: typeof row.translation === 'string' ? row.translation : null,
        translationLanguage: ['ko', 'ja', 'zh-Hans', 'es', 'pt-BR'].includes(String(row.translation_language))
          ? row.translation_language as SavedWordDetails['translationLanguage'] : null,
        sourceUrl: typeof row.source_url === 'string' ? row.source_url : null,
        licenseName: typeof row.license_name === 'string' ? row.license_name : null,
        licenseUrl: typeof row.license_url === 'string' ? row.license_url : null,
        detailsUpdatedAt: typeof row.details_updated_at === 'string'
          ? row.details_updated_at : row.updated_at,
      } : null
      const source = row.source === 'phrases-api' ? 'kaikki-phrases'
        : row.source === 'both' ? 'combined'
          : row.source
      if (!['free-dictionary', 'kaikki-phrases', 'combined'].includes(String(source))) return []
      return [{
        id: row.id,
        word: row.word,
        normalizedWord: row.normalized_word,
        source: source as SearchSource,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        note: typeof row.note === 'string' ? row.note : '',
        details,
        tags: tagsByWord.get(row.id) ?? [],
        review,
        mastery: masteryForBox(review?.box ?? null),
        due: isReviewDue(review?.nextDueAt ?? null, this.now()),
      }]
    })
  }

  async delete(user: User, normalizedWord: string): Promise<void> {
    const client = this.requireClient()

    const { error } = await client
      .from('saved_words')
      .delete()
      .eq('user_id', user.id)
      .eq('normalized_word', normalizedWord.toLowerCase())

    if (error) this.fail('delete saved word', error)
  }

  async updateDetails(user: User, savedWordId: string, details: SavedWordDetails): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.from('saved_words').update({
      part_of_speech: details.partOfSpeech,
      definition: details.definition,
      example: details.example,
      synonyms: details.synonyms,
      antonyms: details.antonyms,
      translation: details.translation,
      translation_language: details.translationLanguage,
      source_url: details.sourceUrl,
      license_name: details.licenseName,
      license_url: details.licenseUrl,
      details_updated_at: details.detailsUpdatedAt,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id).eq('id', savedWordId)
    if (error) this.fail('update saved word details', error)
  }

  async updateNote(user: User, savedWordId: string, note: string): Promise<void> {
    const client = this.requireClient()
    if (note.length > 4000) throw new Error('Notes can be at most 4,000 characters.')
    const { error } = await client.from('saved_words')
      .update({ note, updated_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('id', savedWordId)
    if (error) this.fail('update saved word note', error)
  }

  async addTag(user: User, savedWordId: string, tag: string): Promise<SavedWordTag> {
    const client = this.requireClient()
    const value = tag.replace(/\s+/g, ' ').trim()
    if (!value || value.length > 40) throw new Error('Tags must be 1–40 characters.')
    const { data, error } = await client.from('saved_word_tags').insert({
      user_id: user.id,
      saved_word_id: savedWordId,
      tag: value,
    }).select('id, saved_word_id, tag, normalized_tag, created_at').single()
    if (error) this.fail('add saved word tag', error)
    const row = data as TagRow
    return {
      id: row.id as string,
      savedWordId: row.saved_word_id as string,
      tag: row.tag as string,
      normalizedTag: row.normalized_tag as string,
      createdAt: row.created_at as string,
    }
  }

  async deleteTag(user: User, tagId: string): Promise<void> {
    const client = this.requireClient()
    const { error } = await client.from('saved_word_tags').delete()
      .eq('user_id', user.id).eq('id', tagId)
    if (error) this.fail('delete saved word tag', error)
  }

  /**
   * Whether the user has already saved a word. Returns false (rather than
   * throwing) when Supabase isn't configured, so durable "Saved" state can be
   * surfaced for words saved in a previous session without breaking the UI.
   */
  async isSaved(user: User, word: string): Promise<boolean> {
    if (!this.client) return false

    const normalized = word.trim().toLowerCase()
    if (!normalized) return false

    const { data, error } = await this.client
      .from('saved_words')
      .select('id')
      .eq('user_id', user.id)
      .eq('normalized_word', normalized)
      .limit(1)
      .maybeSingle()

    if (error) this.fail('check saved word', error)
    return Boolean(data)
  }

  /** Number of words the user has saved (head-only count query). */
  async count(user: User): Promise<number> {
    const client = this.requireClient()
    const { count, error } = await client
      .from('saved_words')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (error) this.fail('count saved words', error)
    return count ?? 0
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase is not configured.')
    }
    return this.client
  }

  private fail(action: string, error: unknown): never {
    const supabaseError = toSupabaseErrorLike(error)
    this.log.event(`${action} error`, {
      message: supabaseError?.message ?? (error instanceof Error ? error.message : String(error)),
      code: supabaseError?.code ?? null,
      details: supabaseError?.details ?? null,
      hint: supabaseError?.hint ?? null,
    })

    const message =
      supabaseError?.message ??
      (error instanceof Error ? error.message : `Could not ${action.replace('-', ' ')}`)
    throw new Error(message)
  }
}

/** App-wide instance wired to the real Supabase client. */
export const savedWords = new SavedWordsRepository(supabase)
