import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('./supabaseClient', () => ({ supabase: { functions: { invoke } } }))

import { fetchIdiom, fetchFreeDictionary, searchDictionary, DictionaryError } from './dictionaryApi'

beforeEach(() => {
  invoke.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchIdiom', () => {
  it('returns the idiom result from the edge function', async () => {
    invoke.mockResolvedValue({
      data: { result: { term: 'break the ice', explanation: 'to initiate conversation' } },
      error: null,
    })

    const result = await fetchIdiom('break the ice')

    expect(result.explanation).toBe('to initiate conversation')
    expect(invoke).toHaveBeenCalledWith('idioms', { body: { phrase: 'break the ice' } })
  })

  it('throws when the edge function returns an error', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(fetchIdiom('break the ice')).rejects.toThrow('boom')
  })

  it('throws when no idiom is found', async () => {
    invoke.mockResolvedValue({ data: { result: null }, error: null })
    await expect(fetchIdiom('not an idiom')).rejects.toThrow('No idiom found')
  })
})

describe('fetchFreeDictionary error kinds', () => {
  it('classifies a thrown fetch as a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(fetchFreeDictionary('hello')).rejects.toMatchObject({ kind: 'network' })
  })

  it('classifies 404 as not-found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(fetchFreeDictionary('asdfqwer')).rejects.toMatchObject({ kind: 'not-found' })
  })

  it('classifies other non-OK responses as a service error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(fetchFreeDictionary('hello')).rejects.toMatchObject({ kind: 'service' })
  })
})

describe('searchDictionary surfaces offline vs not-found', () => {
  it('maps a network failure to a connection message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(searchDictionary('hello')).rejects.toThrow(/connection/i)
  })

  it('maps a 404 to a not-found message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(searchDictionary('asdfqwer')).rejects.toThrow(/not found/i)
  })

  it('exposes DictionaryError for callers that want the kind', () => {
    expect(new DictionaryError('network').kind).toBe('network')
  })
})
