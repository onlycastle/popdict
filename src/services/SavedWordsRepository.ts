import type { SupabaseClient, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { SearchSource } from '../types/dictionary'
import { createLogger } from '../../shared/logger'

export type SaveWordInput = {
  source: SearchSource
  user: User
  word: string
}

export type SavedWord = {
  id: string
  word: string
  normalized_word: string
  source: SearchSource
  created_at: string
  updated_at: string
}

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

  constructor(private client: SupabaseClient | null) {}

  async save({ source, user, word }: SaveWordInput): Promise<void> {
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

    const { error } = await client.from('saved_words').upsert(
      {
        normalized_word: trimmedWord.toLowerCase(),
        source,
        updated_at: new Date().toISOString(),
        user_id: user.id,
        word: trimmedWord,
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

    const { data, error } = await client
      .from('saved_words')
      .select('id, word, normalized_word, source, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) this.fail('load saved words', error)
    return (data ?? []) as SavedWord[]
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
