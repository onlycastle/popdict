import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { consumeRequestQuota, requestQuotaKey } from './requestQuota.ts'

const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 198.51.100.2' })
const now = new Date('2026-07-15T02:30:00Z')

Deno.test('requestQuotaKey is hourly, scoped, and never contains the raw address', async () => {
  const first = await requestQuotaKey(headers, 'feedback', 'documented-fake-secret', now)
  const again = await requestQuotaKey(headers, 'feedback', 'documented-fake-secret', now)
  const nextHour = await requestQuotaKey(
    headers,
    'feedback',
    'documented-fake-secret',
    new Date('2026-07-15T03:00:00Z'),
  )
  const otherScope = await requestQuotaKey(headers, 'events', 'documented-fake-secret', now)

  assertEquals(first, again)
  assertEquals(first.length, 64)
  assert(!first.includes('203.0.113.7'))
  assert(first !== nextHour)
  assert(first !== otherScope)
})

Deno.test('consumeRequestQuota returns denial and fails closed on RPC errors', async () => {
  const denied = await consumeRequestQuota({
    headers,
    limit: 5,
    scope: 'feedback',
    secret: 'documented-fake-secret',
    now,
    consume: async (keyHash, limit) => {
      assertEquals(keyHash.length, 64)
      assertEquals(limit, 5)
      return { data: false, error: null }
    },
  })
  assertEquals(denied, false)

  await assertRejects(() => consumeRequestQuota({
    headers,
    limit: 5,
    scope: 'feedback',
    secret: 'documented-fake-secret',
    now,
    consume: async () => ({ data: null, error: new Error('down') }),
  }))

  await assertRejects(() => requestQuotaKey(
    new Headers({ 'x-real-ip': '203.0.113.7' }),
    'feedback',
    'documented-fake-secret',
    now,
  ))
})
