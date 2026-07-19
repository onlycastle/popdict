import { assertEquals } from 'jsr:@std/assert@1'
import { validateFeedbackSubmission } from './lib.ts'

const requestId = '018f6d80-b4d2-7d4c-a911-9d77d4df9c65'

Deno.test('validateFeedbackSubmission accepts and bounds private feedback', () => {
  assertEquals(validateFeedbackSubmission({
    requestId,
    type: 'bug',
    message: '  Search froze.\r\nPlease help.  ',
    contact: ' person@example.test ',
    context: 'Current screen: search',
    version: '1.7.0',
    platform: 'macOS',
  }), {
    ok: true,
    value: {
      client_request_id: requestId,
      category: 'bug',
      message: 'Search froze.\nPlease help.',
      contact: 'person@example.test',
      context: 'Current screen: search',
      app_version: '1.7.0',
      platform: 'macOS',
    },
  })
})

Deno.test('validateFeedbackSubmission rejects empty, malformed, and honeypot payloads', () => {
  assertEquals(validateFeedbackSubmission(null), { ok: false, message: 'Invalid feedback payload.' })
  assertEquals(validateFeedbackSubmission({ requestId, message: '   ' }), {
    ok: false,
    message: 'Feedback message is required.',
  })
  assertEquals(validateFeedbackSubmission({ requestId: 'bad', message: 'Hello' }), {
    ok: false,
    message: 'Invalid request id.',
  })
  assertEquals(validateFeedbackSubmission({ requestId, message: 'Hello', website: 'bot' }), {
    ok: false,
    message: 'Invalid feedback payload.',
  })
})
