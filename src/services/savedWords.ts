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

export async function saveWord({ source, user, word }: SaveWordInput): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const trimmedWord = word.trim()
  if (!trimmedWord) {
    throw new Error('No word to save.')
  }

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

  if (error) throw error
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

  if (error) throw error
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

  if (error) throw error
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

  if (error) throw error
  return Boolean(data)
}
