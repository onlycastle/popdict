import { describe, expect, it, vi } from 'vitest'
import { createProductAnalytics } from './ProductAnalytics'

describe('ProductAnalytics', () => {
  it('sends only the allowlisted anonymous event envelope when enabled', async () => {
    const invoke = vi.fn().mockResolvedValue({ error: null })
    const analytics = createProductAnalytics({
      client: { functions: { invoke } } as never,
      createEventId: () => '018f6d80-b4d2-7d4c-a911-9d77d4df9c65',
      getEnabled: async () => true,
      getSessionId: async () => '018f6d80-b4d2-7d4c-a911-9d77d4df9c66',
      getVersion: async () => '1.7.0',
    })

    await analytics.track('lookup_success')
    expect(invoke).toHaveBeenCalledWith('events', {
      body: {
        eventId: '018f6d80-b4d2-7d4c-a911-9d77d4df9c65',
        sessionId: '018f6d80-b4d2-7d4c-a911-9d77d4df9c66',
        eventName: 'lookup_success',
        version: '1.7.0',
        platform: 'macOS',
      },
    })
  })

  it('does nothing when analytics is disabled', async () => {
    const invoke = vi.fn()
    const analytics = createProductAnalytics({
      client: { functions: { invoke } } as never,
      createEventId: crypto.randomUUID,
      getEnabled: async () => false,
      getSessionId: async () => crypto.randomUUID(),
      getVersion: async () => '1.7.0',
    })

    await analytics.track('first_launch')
    expect(invoke).not.toHaveBeenCalled()
  })
})
