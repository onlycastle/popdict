export const FEEDBACK_TYPES = ['bug', 'idea', 'dictionary', 'other'] as const

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export type FeedbackPayload = {
  type?: FeedbackType
  message?: string
  contact?: string
  context?: string
}

export type FeedbackSubmitResult =
  | { ok: true }
  | { ok: false; message: string }

function clamp(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\r\n/g, '\n').slice(0, maxLength)
}

export function normalizeFeedbackType(type: unknown): FeedbackType {
  return FEEDBACK_TYPES.includes(type as FeedbackType) ? (type as FeedbackType) : 'other'
}

export function normalizeFeedbackPayload(payload: FeedbackPayload = {}): Required<FeedbackPayload> {
  return {
    type: normalizeFeedbackType(payload.type),
    message: clamp(payload.message, 1800),
    contact: clamp(payload.contact, 160),
    context: clamp(payload.context, 500),
  }
}
