export type ReviewReminderCadence = 'off' | 'daily' | 'three-weekly' | 'weekly'

export type ReviewReminderSettings = {
  cadence: ReviewReminderCadence
  time: string
  threeWeeklyDays: number[]
  weeklyDay: number
  quietStart: string
  quietEnd: string
}

export const DEFAULT_REVIEW_REMINDER_SETTINGS: ReviewReminderSettings = {
  cadence: 'off',
  time: '09:00',
  threeWeeklyDays: [1, 3, 5],
  weeklyDay: 1,
  quietStart: '22:00',
  quietEnd: '08:00',
}

export function isLocalTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function reviewReminderSettings(value: unknown): ReviewReminderSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_REVIEW_REMINDER_SETTINGS }
  const input = value as Partial<ReviewReminderSettings>
  const cadence = ['off', 'daily', 'three-weekly', 'weekly'].includes(input.cadence ?? '')
    ? input.cadence as ReviewReminderCadence
    : DEFAULT_REVIEW_REMINDER_SETTINGS.cadence
  const days = Array.isArray(input.threeWeeklyDays)
    ? [...new Set(input.threeWeeklyDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : []
  return {
    cadence,
    time: isLocalTime(input.time) ? input.time : DEFAULT_REVIEW_REMINDER_SETTINGS.time,
    threeWeeklyDays: days.length > 0 ? days : [...DEFAULT_REVIEW_REMINDER_SETTINGS.threeWeeklyDays],
    weeklyDay: Number.isInteger(input.weeklyDay) && (input.weeklyDay ?? -1) >= 0 && (input.weeklyDay ?? 7) <= 6
      ? input.weeklyDay as number : DEFAULT_REVIEW_REMINDER_SETTINGS.weeklyDay,
    quietStart: isLocalTime(input.quietStart)
      ? input.quietStart : DEFAULT_REVIEW_REMINDER_SETTINGS.quietStart,
    quietEnd: isLocalTime(input.quietEnd)
      ? input.quietEnd : DEFAULT_REVIEW_REMINDER_SETTINGS.quietEnd,
  }
}
