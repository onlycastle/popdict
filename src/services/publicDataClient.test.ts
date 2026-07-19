import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PUBLIC_SUPABASE_AUTH_OPTIONS } from './supabaseClient'

describe('public Supabase client boundary', () => {
  it('never persists, refreshes, or detects an authenticated session', () => {
    expect(PUBLIC_SUPABASE_AUTH_OPTIONS).toEqual({
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    })
  })

  it('routes vocabulary and anonymous endpoints through the public client', () => {
    for (const path of [
      'src/services/TranslationService.ts',
      'src/services/dictionary/KaikkiPhraseSource.ts',
      'src/services/ProductAnalytics.ts',
      'src/services/FeedbackService.ts',
    ]) {
      const source = readFileSync(path, 'utf8')
      expect(source).toMatch(/import \{ publicSupabase \} from/)
      expect(source).not.toMatch(/import \{ supabase \} from/)
    }
  })
})
