import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveRecordContext, postDownloadRecord } from './record'

describe('deriveRecordContext', () => {
  it('pulls referrer + country from headers with release info', () => {
    const headers = new Headers({ referer: 'https://x.com/a', 'x-vercel-ip-country': 'US' })
    expect(deriveRecordContext(headers, { tag: 'v1.1.1', assetName: 'PopDict.dmg' })).toEqual({
      action: 'record', version: 'v1.1.1', asset: 'PopDict.dmg', referrer: 'https://x.com/a', country: 'US',
    })
  })

  it('tolerates missing headers', () => {
    expect(deriveRecordContext(new Headers(), { tag: 'v1', assetName: 'a.dmg' })).toEqual({
      action: 'record', version: 'v1', asset: 'a.dmg', referrer: null, country: null,
    })
  })
})

describe('postDownloadRecord', () => {
  const payload = { action: 'record', version: 'v1', asset: 'a.dmg', referrer: null, country: null } as const
  beforeEach(() => {
    process.env.DOWNLOADS_FN_URL = 'https://fn.example/downloads'
    process.env.DOWNLOADS_RECORD_TOKEN = 'sekret'
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.DOWNLOADS_FN_URL
    delete process.env.DOWNLOADS_RECORD_TOKEN
  })

  it('posts with the record token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await postDownloadRecord(payload)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://fn.example/downloads')
    expect((init.headers as Record<string, string>)['x-record-token']).toBe('sekret')
    expect(JSON.parse(init.body as string).action).toBe('record')
  })

  it('swallows fetch failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await expect(postDownloadRecord(payload)).resolves.toBeUndefined()
  })

  it('no-ops when unconfigured', async () => {
    delete process.env.DOWNLOADS_FN_URL
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await postDownloadRecord(payload)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
