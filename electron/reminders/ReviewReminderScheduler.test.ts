import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_REVIEW_REMINDER_SETTINGS } from '../../shared/reminders'
import { ReviewReminderScheduler } from './ReviewReminderScheduler'

describe('ReviewReminderScheduler', () => {
  it('marks one cadence window, requests due count, and sends count-only notification', async () => {
    vi.useFakeTimers()
    try {
      let lastFiredWindow: string | null = null
      const requestDueCount = vi.fn().mockResolvedValue(3)
      const notify = vi.fn()
      const scheduler = new ReviewReminderScheduler({
        getState: () => ({
          settings: { ...DEFAULT_REVIEW_REMINDER_SETTINGS, cadence: 'daily' },
          lastFiredWindow,
        }),
        markFired: (windowId) => { lastFiredWindow = windowId },
        requestDueCount,
        notify,
        now: () => new Date(2026, 6, 20, 10, 0),
      })
      scheduler.recalculate()
      await vi.runOnlyPendingTimersAsync()
      expect(requestDueCount).toHaveBeenCalledOnce()
      expect(notify).toHaveBeenCalledWith(3)
      expect(lastFiredWindow).toContain('daily:2026-07-20')
      scheduler.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks an empty window without notifying, preventing repeat catch-up', async () => {
    vi.useFakeTimers()
    try {
      let lastFiredWindow: string | null = null
      const notify = vi.fn()
      const scheduler = new ReviewReminderScheduler({
        getState: () => ({
          settings: { ...DEFAULT_REVIEW_REMINDER_SETTINGS, cadence: 'daily' },
          lastFiredWindow,
        }),
        markFired: (windowId) => { lastFiredWindow = windowId },
        requestDueCount: async () => 0,
        notify,
        now: () => new Date(2026, 6, 20, 10, 0),
      })
      scheduler.recalculate()
      await vi.runOnlyPendingTimersAsync()
      expect(notify).not.toHaveBeenCalled()
      expect(lastFiredWindow).not.toBeNull()
      scheduler.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('rechecks long weekly waits without firing before the planned occurrence', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 6, 19, 10, 0)) // Sunday
      let lastFiredWindow: string | null = null
      const requestDueCount = vi.fn().mockResolvedValue(2)
      const notify = vi.fn()
      const scheduler = new ReviewReminderScheduler({
        getState: () => ({
          settings: {
            ...DEFAULT_REVIEW_REMINDER_SETTINGS,
            cadence: 'weekly',
            weeklyDay: 4,
            time: '09:00',
          },
          lastFiredWindow,
        }),
        markFired: (windowId) => { lastFiredWindow = windowId },
        requestDueCount,
        notify,
        now: () => new Date(Date.now()),
      })

      scheduler.recalculate(true)
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
      expect(requestDueCount).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(71 * 60 * 60 * 1000)
      expect(requestDueCount).toHaveBeenCalledOnce()
      expect(notify).toHaveBeenCalledWith(2)
      expect(lastFiredWindow).toContain('weekly:2026-07-23')
      scheduler.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not fire at the 24-hour recheck before a 25-hour DST window', async () => {
    const originalTimezone = process.env.TZ
    process.env.TZ = 'America/New_York'
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 9, 31, 9, 0)) // Saturday before fall-back
      let lastFiredWindow: string | null = null
      const requestDueCount = vi.fn().mockResolvedValue(1)
      const notify = vi.fn()
      const scheduler = new ReviewReminderScheduler({
        getState: () => ({
          settings: {
            ...DEFAULT_REVIEW_REMINDER_SETTINGS,
            cadence: 'weekly',
            weeklyDay: 0,
            time: '09:00',
          },
          lastFiredWindow,
        }),
        markFired: (windowId) => { lastFiredWindow = windowId },
        requestDueCount,
        notify,
        now: () => new Date(Date.now()),
      })

      scheduler.recalculate(true)
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
      expect(requestDueCount).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(requestDueCount).toHaveBeenCalledOnce()
      expect(notify).toHaveBeenCalledWith(1)
      scheduler.stop()
    } finally {
      vi.useRealTimers()
      if (originalTimezone === undefined) delete process.env.TZ
      else process.env.TZ = originalTimezone
    }
  })
})
