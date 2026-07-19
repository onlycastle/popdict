import type { ReviewReminderSettings } from '../../shared/reminders'
import { nextReminderPlan, timerDelay } from './schedule'

type SchedulerState = {
  settings: ReviewReminderSettings
  lastFiredWindow: string | null
}

export type ReminderSchedulerDeps = {
  getState: () => SchedulerState
  markFired: (windowId: string) => void
  requestDueCount: () => Promise<number>
  notify: (count: number) => void
  now?: () => Date
}

export class ReviewReminderScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private generation = 0

  constructor(private deps: ReminderSchedulerDeps) {}

  recalculate(skipCatchUp = false): void {
    this.generation += 1
    const generation = this.generation
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const now = this.deps.now?.() ?? new Date()
    const state = this.deps.getState()
    const plan = nextReminderPlan({
      now,
      settings: state.settings,
      lastFiredWindow: state.lastFiredWindow,
      skipCatchUp,
    })
    if (!plan) return
    this.timer = setTimeout(() => {
      if (generation !== this.generation) return
      void this.fire(plan.windowId)
    }, timerDelay(now, plan.fireAt))
    this.timer.unref?.()
  }

  stop(): void {
    this.generation += 1
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private async fire(windowId: string): Promise<void> {
    const state = this.deps.getState()
    if (state.settings.cadence === 'off' || state.lastFiredWindow === windowId) {
      this.recalculate()
      return
    }
    this.deps.markFired(windowId)
    const count = await this.deps.requestDueCount().catch(() => 0)
    if (count > 0) this.deps.notify(count)
    this.recalculate()
  }
}
