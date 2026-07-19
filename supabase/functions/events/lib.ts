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
] as const

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number]

export type ProductEvent = {
  client_event_id: string
  session_id: string
  event_name: ProductEventName
  app_version: string
  platform: string
}

export type EventValidationResult =
  | { ok: true; value: ProductEvent }
  | { ok: false; message: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.replaceAll('\u0000', '').trim().slice(0, maxLength) : ''
}

export function validateProductEvent(input: unknown): EventValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'Invalid event payload.' }
  }

  const body = input as Record<string, unknown>
  const eventName = body.eventName as ProductEventName
  const eventId = cleanText(body.eventId, 80)
  const sessionId = cleanText(body.sessionId, 80)
  const appVersion = cleanText(body.version, 80) || 'unknown'
  const platform = cleanText(body.platform, 80) || 'unknown'

  if (!PRODUCT_EVENT_NAMES.includes(eventName)) return { ok: false, message: 'Unknown event.' }
  if (!UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(sessionId)) {
    return { ok: false, message: 'Invalid event id.' }
  }

  return {
    ok: true,
    value: {
      client_event_id: eventId,
      session_id: sessionId,
      event_name: eventName,
      app_version: appVersion,
      platform,
    },
  }
}
