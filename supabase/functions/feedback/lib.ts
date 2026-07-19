export const FEEDBACK_CATEGORIES = ['bug', 'idea', 'dictionary', 'other'] as const

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

export type FeedbackSubmission = {
  client_request_id: string
  category: FeedbackCategory
  message: string
  contact: string | null
  context: string | null
  app_version: string
  platform: string
}

export type ValidationResult =
  | { ok: true; value: FeedbackSubmission }
  | { ok: false; message: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.replaceAll('\u0000', '').trim().replace(/\r\n/g, '\n').slice(0, maxLength)
}

export function validateFeedbackSubmission(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'Invalid feedback payload.' }
  }

  const body = input as Record<string, unknown>
  if (body.website) return { ok: false, message: 'Invalid feedback payload.' }

  const category = FEEDBACK_CATEGORIES.includes(body.type as FeedbackCategory)
    ? body.type as FeedbackCategory
    : 'other'
  const message = cleanText(body.message, 1800)
  const contact = cleanText(body.contact, 160)
  const context = cleanText(body.context, 500)
  const appVersion = cleanText(body.version, 80) || 'unknown'
  const platform = cleanText(body.platform, 80) || 'unknown'
  const requestId = cleanText(body.requestId, 80)

  if (!message) return { ok: false, message: 'Feedback message is required.' }
  if (!UUID_PATTERN.test(requestId)) return { ok: false, message: 'Invalid request id.' }

  return {
    ok: true,
    value: {
      client_request_id: requestId,
      category,
      message,
      contact: contact || null,
      context: context || null,
      app_version: appVersion,
      platform,
    },
  }
}
