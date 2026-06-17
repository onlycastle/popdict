import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchPhrasesAPI } from './dictionaryApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPhrasesAPI', () => {
  it('throws when credentials are empty', async () => {
    await expect(fetchPhrasesAPI('kick the bucket', { uid: '', token: '' }))
      .rejects.toThrow('Phrases API credentials not configured')
  })

  it('calls STANDS4 with the provided credentials and returns the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: { result: { term: 'x', explanation: 'y' } } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPhrasesAPI('break the ice', { uid: 'U', token: 'T' })

    expect(result.explanation).toBe('y')
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('uid=U')
    expect(calledUrl).toContain('tokenid=T')
  })
})
