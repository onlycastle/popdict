import { describe, expect, it, vi } from 'vitest'
import { DueCountBroker } from './DueCountBroker'

function windowFixture(id = 4) {
  const send = vi.fn()
  const webContents = { id, send, isDestroyed: () => false }
  return {
    window: { isDestroyed: () => false, webContents } as never,
    webContents: webContents as never,
    send,
  }
}

describe('DueCountBroker', () => {
  it('accepts a bounded count only for the main-issued nonce and sender', async () => {
    const broker = new DueCountBroker()
    const fixture = windowFixture()
    const result = broker.request(fixture.window)
    const nonce = fixture.send.mock.calls[0][1]
    expect(broker.resolve({ id: 5 } as never, nonce, 7)).toBe(false)
    expect(broker.resolve(fixture.webContents, 'wrong', 7)).toBe(false)
    expect(broker.resolve(fixture.webContents, nonce, 7)).toBe(true)
    await expect(result).resolves.toBe(7)
  })

  it('rejects malformed counts without consuming the nonce', async () => {
    const broker = new DueCountBroker()
    const fixture = windowFixture()
    const result = broker.request(fixture.window)
    const nonce = fixture.send.mock.calls[0][1]
    expect(broker.resolve(fixture.webContents, nonce, 'seven')).toBe(false)
    broker.clear()
    await expect(result).resolves.toBe(0)
  })
})
