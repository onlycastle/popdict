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
})
