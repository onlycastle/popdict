import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAuthorizedCron, triggerSnapshot } from './snapshot'

describe('isAuthorizedCron', () => {
  afterEach(() => { delete process.env.CRON_SECRET })

  it('accepts the matching bearer secret', () => {
    process.env.CRON_SECRET = 's3cret'
    expect(isAuthorizedCron(new Headers({ authorization: 'Bearer s3cret' }))).toBe(true)
  })

  it('rejects a wrong or missing secret', () => {
    process.env.CRON_SECRET = 's3cret'
    expect(isAuthorizedCron(new Headers({ authorization: 'Bearer nope' }))).toBe(false)
    expect(isAuthorizedCron(new Headers())).toBe(false)
  })

  it('rejects when CRON_SECRET is unset', () => {
    expect(isAuthorizedCron(new Headers({ authorization: 'Bearer anything' }))).toBe(false)
  })
})

describe('triggerSnapshot', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.DOWNLOADS_FN_URL
    delete process.env.DOWNLOADS_STATS_TOKEN
  })

  it('posts the snapshot action with the admin token', async () => {
    process.env.DOWNLOADS_FN_URL = 'https://fn.example/downloads'
    process.env.DOWNLOADS_STATS_TOKEN = 'admin'
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await triggerSnapshot()
    expect(res.ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://fn.example/downloads')
    expect((init.headers as Record<string, string>)['x-admin-token']).toBe('admin')
    expect(JSON.parse(init.body as string).action).toBe('snapshot')
  })
})
