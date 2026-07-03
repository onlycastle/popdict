import type { SupabaseClient, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { createLogger } from '../../shared/logger'

export type QuizPreferences = {
  user_id: string
  enabled: boolean
  cadence: string
  streak: number
}

/**
 * Data access for `quiz_preferences`. Mirrors SavedWordsRepository: reads are
 * tolerant of a missing client (return null) so UI can degrade; writes throw.
 */
export class QuizPreferencesRepository {
  private log = createLogger('QuizPrefs')

  constructor(private client: SupabaseClient | null) {}

  async get(user: User): Promise<QuizPreferences | null> {
    if (!this.client) return null
    const { data, error } = await this.client
      .from('quiz_preferences')
      .select('user_id, enabled, cadence, streak')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) this.fail('load quiz preferences', error)
    return (data as QuizPreferences | null) ?? null
  }

  async setEnabled(user: User, enabled: boolean): Promise<void> {
    if (!this.client) throw new Error('Supabase is not configured.')
    const { error } = await this.client.from('quiz_preferences').upsert(
      { user_id: user.id, enabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (error) this.fail('save quiz preferences', error)
    this.log.event('setEnabled', { enabled, userIdPrefix: user.id.slice(0, 8) })
  }

  private fail(action: string, error: unknown): never {
    const message =
      (error as { message?: string })?.message ??
      (error instanceof Error ? error.message : `Could not ${action}`)
    this.log.event(`${action} error`, { message })
    throw new Error(message)
  }
}

/** App-wide instance wired to the real Supabase client. */
export const quizPreferences = new QuizPreferencesRepository(supabase)
