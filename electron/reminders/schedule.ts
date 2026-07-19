import type { ReviewReminderSettings } from '../../shared/reminders'

const DAY_MS = 24 * 60 * 60 * 1000

function timeParts(value: string): [number, number] {
  const [hour, minute] = value.split(':').map(Number)
  return [hour, minute]
}

function atLocalTime(date: Date, time: string): Date {
  const [hour, minute] = timeParts(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0)
}

function dateMatches(date: Date, settings: ReviewReminderSettings): boolean {
  if (settings.cadence === 'daily') return true
  if (settings.cadence === 'three-weekly') return settings.threeWeeklyDays.includes(date.getDay())
  if (settings.cadence === 'weekly') return date.getDay() === settings.weeklyDay
  return false
}

export function reminderWindowId(date: Date, settings: ReviewReminderSettings): string {
  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  return `${settings.cadence}:${dateKey}:${settings.time}`
}

export function latestReminderOccurrence(
  now: Date,
  settings: ReviewReminderSettings
): Date | null {
  if (settings.cadence === 'off') return null
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    if (!dateMatches(day, settings)) continue
    const candidate = atLocalTime(day, settings.time)
    if (candidate.getTime() <= now.getTime()) return candidate
  }
  return null
}

export function nextReminderOccurrence(
  now: Date,
  settings: ReviewReminderSettings
): Date | null {
  if (settings.cadence === 'off') return null
  for (let offset = 0; offset <= 8; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    if (!dateMatches(day, settings)) continue
    const candidate = atLocalTime(day, settings.time)
    if (candidate.getTime() > now.getTime()) return candidate
  }
  return null
}

function minutes(value: string): number {
  const [hour, minute] = timeParts(value)
  return hour * 60 + minute
}

export function isInQuietHours(date: Date, settings: ReviewReminderSettings): boolean {
  const start = minutes(settings.quietStart)
  const end = minutes(settings.quietEnd)
  if (start === end) return false
  const current = date.getHours() * 60 + date.getMinutes()
  return start < end
    ? current >= start && current < end
    : current >= start || current < end
}

export function deferPastQuietHours(
  date: Date,
  settings: ReviewReminderSettings
): Date {
  if (!isInQuietHours(date, settings)) return date
  const start = minutes(settings.quietStart)
  const end = minutes(settings.quietEnd)
  const current = date.getHours() * 60 + date.getMinutes()
  const [endHour, endMinute] = timeParts(settings.quietEnd)
  const addDay = start > end && current >= start ? 1 : 0
  return new Date(
    date.getFullYear(), date.getMonth(), date.getDate() + addDay,
    endHour, endMinute, 0, 0
  )
}

export type ReminderPlan = { fireAt: Date; windowId: string }

export function nextReminderPlan(input: {
  now: Date
  settings: ReviewReminderSettings
  lastFiredWindow: string | null
  skipCatchUp?: boolean
}): ReminderPlan | null {
  if (input.settings.cadence === 'off') return null
  if (!input.skipCatchUp) {
    const latest = latestReminderOccurrence(input.now, input.settings)
    if (latest) {
      const windowId = reminderWindowId(latest, input.settings)
      if (windowId !== input.lastFiredWindow) {
        const occurrenceTarget = deferPastQuietHours(latest, input.settings)
        const nowTarget = deferPastQuietHours(input.now, input.settings)
        return {
          windowId,
          fireAt: new Date(Math.max(occurrenceTarget.getTime(), nowTarget.getTime())),
        }
      }
    }
  }
  const next = nextReminderOccurrence(input.now, input.settings)
  return next ? {
    fireAt: deferPastQuietHours(next, input.settings),
    windowId: reminderWindowId(next, input.settings),
  } : null
}

export function timerDelay(now: Date, fireAt: Date): number {
  return Math.max(0, Math.min(fireAt.getTime() - now.getTime(), DAY_MS))
}
