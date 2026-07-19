import { describe, expect, it } from 'vitest'
import { DEFAULT_REVIEW_REMINDER_SETTINGS } from '../../shared/reminders'
import {
  deferPastQuietHours,
  isInQuietHours,
  latestReminderOccurrence,
  nextReminderPlan,
  nextReminderOccurrence,
} from './schedule'

const settings = { ...DEFAULT_REVIEW_REMINDER_SETTINGS, cadence: 'daily' as const }

describe('review reminder cadence', () => {
  it('schedules daily, Monday/Wednesday/Friday, and weekly local occurrences', () => {
    const sunday = new Date(2026, 6, 19, 10, 0)
    expect(nextReminderOccurrence(sunday, settings)?.getDay()).toBe(1)
    expect(nextReminderOccurrence(sunday, { ...settings, cadence: 'three-weekly' })?.getDay()).toBe(1)
    expect(nextReminderOccurrence(sunday, { ...settings, cadence: 'weekly', weeklyDay: 4 })?.getDay()).toBe(4)
    expect(latestReminderOccurrence(new Date(2026, 6, 20, 10, 0), settings)?.getHours()).toBe(9)
  })

  it('handles quiet hours crossing midnight and defers to quiet-hour end', () => {
    expect(isInQuietHours(new Date(2026, 6, 20, 23, 0), settings)).toBe(true)
    expect(isInQuietHours(new Date(2026, 6, 21, 7, 59), settings)).toBe(true)
    expect(isInQuietHours(new Date(2026, 6, 21, 8, 0), settings)).toBe(false)
    expect(deferPastQuietHours(new Date(2026, 6, 20, 23, 0), settings))
      .toEqual(new Date(2026, 6, 21, 8, 0))
  })

  it('returns one catch-up window after resume and suppresses a fired window', () => {
    const now = new Date(2026, 6, 20, 14, 0)
    const plan = nextReminderPlan({ now, settings, lastFiredWindow: null })
    expect(plan?.fireAt).toEqual(now)
    expect(nextReminderPlan({ now, settings, lastFiredWindow: plan!.windowId })?.fireAt)
      .toEqual(new Date(2026, 6, 21, 9, 0))
  })

  it('constructs valid local times through DST calendar boundaries', () => {
    const before = new Date(2026, 2, 7, 12, 0)
    const next = nextReminderOccurrence(before, { ...settings, time: '09:00' })
    expect(next?.getHours()).toBe(9)
    expect(next?.getMinutes()).toBe(0)
    expect(next!.getTime()).toBeGreaterThan(before.getTime())
  })
})
