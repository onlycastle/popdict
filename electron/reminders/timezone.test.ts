import { describe, expect, it } from 'vitest'
import { timezoneFingerprint } from './timezone'

describe('timezoneFingerprint', () => {
  it('changes for a timezone-ID change even when the current offset matches', () => {
    const date = new Date('2026-07-19T12:00:00Z')
    expect(timezoneFingerprint(date, 'Asia/Seoul')).not.toBe(
      timezoneFingerprint(date, 'Asia/Tokyo')
    )
  })

  it('changes when a DST transition changes the local offset', () => {
    const date = new Date('2026-01-15T12:00:00Z')
    expect(timezoneFingerprint(date, 'America/New_York', 300)).not.toBe(
      timezoneFingerprint(date, 'America/New_York', 240)
    )
  })
})
