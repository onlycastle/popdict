import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DictionaryResult } from '../../types/dictionary'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../supabaseClient', () => ({ supabase: { functions: { invoke } } }))

import { FreeDictionarySource } from './FreeDictionarySource'
import { IdiomSource } from './IdiomSource'
import { DictionaryService } from './DictionaryService'
import { DictionaryError } from './DictionaryError'

beforeEach(() => {
  invoke.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('IdiomSource', () => {
  it('returns the idiom result from the edge function', async () => {
    invoke.mockResolvedValue({
      data: { result: { term: 'break the ice', explanation: 'to initiate conversation' } },
      error: null,
    })

    const result = await new IdiomSource().lookup('break the ice')

    expect(result.explanation).toBe('to initiate conversation')
    expect(invoke).toHaveBeenCalledWith('idioms', { body: { phrase: 'break the ice' } })
  })

  it('throws when the edge function returns an error', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(new IdiomSource().lookup('break the ice')).rejects.toThrow('boom')
  })

  it('throws when no idiom is found', async () => {
    invoke.mockResolvedValue({ data: { result: null }, error: null })
    await expect(new IdiomSource().lookup('not an idiom')).rejects.toThrow('No idiom found')
  })

  it('throws when supabase is not configured', async () => {
    await expect(new IdiomSource(null).lookup('x')).rejects.toThrow(/not configured/i)
  })
})

describe('FreeDictionarySource error kinds', () => {
  const source = new FreeDictionarySource()

  it('classifies a thrown fetch as a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(source.lookup('hello')).rejects.toMatchObject({ kind: 'network' })
  })

  it('classifies 404 as not-found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(source.lookup('asdfqwer')).rejects.toMatchObject({ kind: 'not-found' })
  })

  it('classifies other non-OK responses as a service error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(source.lookup('hello')).rejects.toMatchObject({ kind: 'service' })
  })
})

describe('DictionaryService.search', () => {
  const service = () => new DictionaryService(new FreeDictionarySource(), new IdiomSource())

  it('rejects an empty query', async () => {
    await expect(service().search('   ')).rejects.toThrow(/empty/i)
  })

  it('returns free-dictionary results for a single word', async () => {
    const entries: DictionaryResult[] = [{ word: 'hello', meanings: [] }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => entries }))

    const res = await service().search('hello')

    expect(res.source).toBe('free-dictionary')
    expect(res.dictionaryResults).toEqual(entries)
    expect(res.idiomResult).toBeNull()
  })

  it('maps a single-word network failure to a connection message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(service().search('hello')).rejects.toThrow(/connection/i)
  })

  it('maps a single-word 404 to a not-found message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(service().search('asdfqwer')).rejects.toThrow(/not found/i)
  })

  it('combines both sources for a multi-word query', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<DictionaryResult[]> => [{ word: 'break the ice', meanings: [] }],
      })
    )
    invoke.mockResolvedValue({
      data: { result: { term: 'break the ice', explanation: 'x' } },
      error: null,
    })

    const res = await service().search('break the ice')

    expect(res.source).toBe('both')
    expect(res.idiomResult?.term).toBe('break the ice')
  })

  it('returns the idiom alone when the dictionary misses a multi-word query', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    invoke.mockResolvedValue({
      data: { result: { term: 'break the ice', explanation: 'x' } },
      error: null,
    })

    const res = await service().search('break the ice')

    expect(res.source).toBe('phrases-api')
    expect(res.dictionaryResults).toBeNull()
    expect(res.idiomResult?.term).toBe('break the ice')
  })

  it('maps a multi-word network failure to a connection message when both sources fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    invoke.mockResolvedValue({ data: { result: null }, error: null })
    await expect(service().search('break the ice')).rejects.toThrow(/connection/i)
  })
})

describe('DictionaryError', () => {
  it('exposes the failure kind', () => {
    expect(new DictionaryError('network').kind).toBe('network')
  })
})
