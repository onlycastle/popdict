import { describe, expect, it, vi } from 'vitest'
import { createFeedbackService } from './FeedbackService'

describe('FeedbackService', () => {
  it('sends bounded private feedback to the feedback function', async () => {
    const invoke = vi.fn().mockResolvedValue({ error: null })
    const service = createFeedbackService({
      client: { functions: { invoke } } as never,
      createRequestId: () => '018f6d80-b4d2-7d4c-a911-9d77d4df9c65',
      getVersion: async () => '1.7.0',
    })

    await expect(service.submit({
      type: 'idea',
      message: '  Add a history shortcut. ',
      contact: 'person@example.test',
    })).resolves.toEqual({ ok: true })

    expect(invoke).toHaveBeenCalledWith('feedback', {
      body: expect.objectContaining({
        type: 'idea',
        message: 'Add a history shortcut.',
        contact: 'person@example.test',
        requestId: '018f6d80-b4d2-7d4c-a911-9d77d4df9c65',
        version: '1.7.0',
        platform: 'macOS',
      }),
    })
  })

  it('rejects empty feedback and handles missing configuration', async () => {
    const configured = createFeedbackService({
      client: { functions: { invoke: vi.fn() } } as never,
      createRequestId: crypto.randomUUID,
      getVersion: async () => '1.7.0',
    })
    await expect(configured.submit({ message: '  ' })).resolves.toEqual({
      ok: false,
      message: 'Add a short note first.',
    })

    const missing = createFeedbackService({
      client: null,
      createRequestId: crypto.randomUUID,
      getVersion: async () => '1.7.0',
    })
    await expect(missing.submit({ message: 'Hello' })).resolves.toEqual({
      ok: false,
      message: 'Feedback is not configured in this build.',
    })
  })
})
