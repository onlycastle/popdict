import { assertEquals } from 'jsr:@std/assert@1'
import { validateProductEvent } from './lib.ts'

const eventId = '018f6d80-b4d2-7d4c-a911-9d77d4df9c65'
const sessionId = '018f6d80-b4d2-7d4c-a911-9d77d4df9c66'

Deno.test('validateProductEvent accepts only the bounded allowlist payload', () => {
  assertEquals(validateProductEvent({
    eventId,
    sessionId,
    eventName: 'lookup_success',
    version: '1.7.0',
    platform: 'macOS',
    query: 'must not be persisted',
  }), {
    ok: true,
    value: {
      client_event_id: eventId,
      session_id: sessionId,
      event_name: 'lookup_success',
      app_version: '1.7.0',
      platform: 'macOS',
    },
  })
})

Deno.test('validateProductEvent rejects unknown events and bad identifiers', () => {
  assertEquals(validateProductEvent({ eventId, sessionId, eventName: 'search_word' }), {
    ok: false,
    message: 'Unknown event.',
  })
  assertEquals(validateProductEvent({ eventId: 'bad', sessionId, eventName: 'first_launch' }), {
    ok: false,
    message: 'Invalid event id.',
  })
})

Deno.test('validateProductEvent accepts the completed pending-save milestone', () => {
  const result = validateProductEvent({ eventId, sessionId, eventName: 'pending_save_completed' })
  assertEquals(result.ok && result.value.event_name, 'pending_save_completed')
})
