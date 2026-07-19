import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export const PRODUCT_EVENT_NAMES = [
  'first_launch',
  'lookup_success',
  'save_intent_signed_out',
  'oauth_started',
  'oauth_completed',
  'pending_save_completed',
  'first_word_saved',
  'feedback_opened',
  'feedback_submitted',
  'lookup_recovery_used',
  'phrase_lookup_success',
  'offline_cache_hit',
  'saved_words_exported',
  'review_reminder_enabled',
  'review_session_completed',
] as const

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number]

export type ProductAnalyticsDeps = {
  client: Pick<SupabaseClient, 'functions'> | null
  createEventId: () => string
  getEnabled: () => Promise<boolean>
  getSessionId: () => Promise<string>
  getVersion: () => Promise<string>
}

export function createProductAnalytics(deps: ProductAnalyticsDeps) {
  return {
    async track(eventName: ProductEventName): Promise<void> {
      try {
        if (!deps.client || !(await deps.getEnabled())) return
        const [version, sessionId] = await Promise.all([deps.getVersion(), deps.getSessionId()])
        await deps.client.functions.invoke('events', {
          body: {
            eventId: deps.createEventId(),
            sessionId,
            eventName,
            version,
            platform: 'macOS',
          },
        })
      } catch {
        // Best-effort only. Product measurement never blocks app behavior.
      }
    },
  }
}

export const productAnalytics = createProductAnalytics({
  client: supabase,
  createEventId: () => crypto.randomUUID(),
  getEnabled: async () => (await window.electronAPI.getSettings()).analyticsEnabled,
  getSessionId: () => window.electronAPI.getAnalyticsSessionId(),
  getVersion: () => window.electronAPI.getAppVersion(),
})
