import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { SearchSource } from '../types/dictionary'

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

function savedWordsDebug(event: string, details?: Record<string, unknown>): void {
  try {
    console.info(`[SavedWords] ${event} ${details ? JSON.stringify(details) : ''}`.trim())
  } catch {
    console.info(`[SavedWords] ${event}`)
  }
}

function toSupabaseErrorLike(error: unknown): SupabaseErrorLike | null {
  if (!error || typeof error !== 'object') return null
  return error as SupabaseErrorLike
}

function throwSavedWordsError(action: string, error: unknown): never {
  const supabaseError = toSupabaseErrorLike(error)
  savedWordsDebug(`${action} error`, {
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

export async function saveWord({ source, user, word }: SaveWordInput): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const trimmedWord = word.trim()
  if (!trimmedWord) {
    throw new Error('No word to save.')
  }

  savedWordsDebug('save start', {
    word: trimmedWord,
    normalizedWord: trimmedWord.toLowerCase(),
    source,
    userIdPrefix: user.id.slice(0, 8),
  })

  const { error } = await supabase
    .from('saved_words')
    .upsert(
      {
        normalized_word: trimmedWord.toLowerCase(),
        source,
        updated_at: new Date().toISOString(),
        user_id: user.id,
        word: trimmedWord,
      },
      { onConflict: 'user_id,normalized_word' }
    )

  if (error) throwSavedWordsError('save word', error)
  savedWordsDebug('save success', {
    word: trimmedWord,
    userIdPrefix: user.id.slice(0, 8),
  })
}

export async function getSavedWords(user: User): Promise<SavedWord[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('saved_words')
    .select('id, word, normalized_word, source, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) throwSavedWordsError('load saved words', error)
  return (data ?? []) as SavedWord[]
}

export async function deleteSavedWord(user: User, normalizedWord: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { error } = await supabase
    .from('saved_words')
    .delete()
    .eq('user_id', user.id)
    .eq('normalized_word', normalizedWord.toLowerCase())

  if (error) throwSavedWordsError('delete saved word', error)
}

/**
 * Whether the user has already saved a word. Used to surface durable "Saved"
 * state for words saved in a previous session (not just the current one).
 */
export async function isWordSaved(user: User, word: string): Promise<boolean> {
  if (!supabase) return false

  const normalized = word.trim().toLowerCase()
  if (!normalized) return false

  const { data, error } = await supabase
    .from('saved_words')
    .select('id')
    .eq('user_id', user.id)
    .eq('normalized_word', normalized)
    .limit(1)
    .maybeSingle()

  if (error) throwSavedWordsError('check saved word', error)
  return Boolean(data)
}
