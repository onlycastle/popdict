export const DEFAULT_FEEDBACK_REPO = 'onlycastle/popdict'

export const FEEDBACK_TYPES = ['bug', 'idea', 'dictionary', 'other'] as const

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export type FeedbackPayload = {
  type?: FeedbackType
  message?: string
  contact?: string
  context?: string
}

export type FeedbackOpenResult =
  | { ok: true }
  | { ok: false; message: string }

export type FeedbackIssueOptions = {
  repo: string
  version: string
  platform: string
}

const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: 'Bug',
  idea: 'Idea',
  dictionary: 'Dictionary',
  other: 'Other',
}

function clamp(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\r\n/g, '\n').slice(0, maxLength)
}

function normalizeFeedbackType(type: unknown): FeedbackType {
  return FEEDBACK_TYPES.includes(type as FeedbackType) ? (type as FeedbackType) : 'other'
}

function normalizeRepo(repo: string): string {
  const trimmed = repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/+$/, '')
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed) ? trimmed : ''
}

function titleSummary(message: string, fallback: string): string {
  const firstLine = message.split('\n').find((line) => line.trim())?.trim() || fallback
  return firstLine.length > 56 ? `${firstLine.slice(0, 53)}...` : firstLine
}

export function buildFeedbackIssueUrl(
  payload: FeedbackPayload = {},
  options: FeedbackIssueOptions
): string {
  const repo = normalizeRepo(options.repo)
  if (!repo) {
    throw new Error('Feedback repository is not configured.')
  }

  const type = normalizeFeedbackType(payload.type)
  const label = TYPE_LABEL[type]
  const message = clamp(payload.message, 1800)
  const contact = clamp(payload.contact, 160)
  const context = clamp(payload.context, 500)
  const version = clamp(options.version, 80) || 'unknown'
  const platform = clamp(options.platform, 80) || 'unknown'
  const title = `${label}: ${titleSummary(message, 'PopDict feedback')} (v${version})`
  const body = [
    `## Category\n${label}`,
    `## Feedback\n${message || '_No details provided._'}`,
    contact ? `## Contact\n${contact}` : '',
    context ? `## Context\n${context}` : '',
    `## Diagnostics\nPopDict ${version}\nPlatform: ${platform}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const params = new URLSearchParams({ title, body })
  return `https://github.com/${repo}/issues/new?${params.toString()}`
}
