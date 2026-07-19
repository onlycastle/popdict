import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizeFeedbackPayload,
  type FeedbackPayload,
  type FeedbackSubmitResult,
} from '../../shared/feedback'
import { supabase } from './supabaseClient'

export type FeedbackServiceDeps = {
  client: Pick<SupabaseClient, 'functions'> | null
  createRequestId: () => string
  getVersion: () => Promise<string>
}

export function createFeedbackService({ client, createRequestId, getVersion }: FeedbackServiceDeps) {
  return {
    async submit(payload: FeedbackPayload): Promise<FeedbackSubmitResult> {
      if (!client) return { ok: false, message: 'Feedback is not configured in this build.' }

      const normalized = normalizeFeedbackPayload(payload)
      if (!normalized.message) return { ok: false, message: 'Add a short note first.' }

      try {
        const version = await getVersion()
        const { error } = await client.functions.invoke('feedback', {
          body: {
            ...normalized,
            requestId: createRequestId(),
            version,
            platform: 'macOS',
            website: '',
          },
        })
        if (error) return { ok: false, message: 'Could not send feedback. Please try again.' }
        return { ok: true }
      } catch {
        return { ok: false, message: 'Could not send feedback. Please try again.' }
      }
    },
  }
}

export const feedbackService = createFeedbackService({
  client: supabase,
  createRequestId: () => crypto.randomUUID(),
  getVersion: () => window.electronAPI.getAppVersion(),
})
