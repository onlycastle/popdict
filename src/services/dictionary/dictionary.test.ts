import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DictionaryResult } from '../../types/dictionary'
import type { DictionarySource } from './DictionarySource'

const { invoke, maybeSingle, mockFrom } = vi.hoisted(() => {
  const maybeSingle = vi.fn()
  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
  }))
  return { invoke: vi.fn(), maybeSingle, mockFrom }
})
vi.mock('../supabaseClient', () => ({ supabase: { functions: { invoke }, from: mockFrom } }))

import { FreeDictionarySource } from './FreeDictionarySource'
import { IdiomSource } from './IdiomSource'
import { KrdictSource } from './KrdictSource'
import { DictionaryService } from './DictionaryService'
import { DictionaryError } from './DictionaryError'
import { EnKoTranslationSource } from './EnKoTranslationSource'

beforeEach(() => {
  invoke.mockReset()
  maybeSingle.mockReset()
  mockFrom.mockClear()
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

describe('KrdictSource', () => {
  it('returns mapped entries from the edge function', async () => {
    const entries = [{ word: '사과', meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'apple' }] }] }]
    invoke.mockResolvedValue({ data: { results: entries }, error: null })

    const results = await new KrdictSource().lookup('사과')

    expect(results).toEqual(entries)
    expect(invoke).toHaveBeenCalledWith('krdict', { body: { word: '사과' } })
  })

  it('maps an empty result set to not-found', async () => {
    invoke.mockResolvedValue({ data: { results: [] }, error: null })
    await expect(new KrdictSource().lookup('없는말')).rejects.toMatchObject({ kind: 'not-found' })
  })

  it('maps a fetch-level failure to a network error', async () => {
    const err = new Error('fetch failed')
    err.name = 'FunctionsFetchError'
    invoke.mockResolvedValue({ data: null, error: err })
    await expect(new KrdictSource().lookup('사과')).rejects.toMatchObject({ kind: 'network' })
  })

  it('maps other invoke errors to a service error', async () => {
    const err = new Error('500')
    err.name = 'FunctionsHttpError'
    invoke.mockResolvedValue({ data: null, error: err })
    await expect(new KrdictSource().lookup('사과')).rejects.toMatchObject({ kind: 'service' })
  })

  it('reports service error when supabase is not configured', async () => {
    await expect(new KrdictSource(null).lookup('사과')).rejects.toMatchObject({ kind: 'service' })
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
  const fakeKrdict = (impl: () => Promise<DictionaryResult[]>): DictionarySource<DictionaryResult[]> => ({
    name: 'krdict',
    lookup: vi.fn(impl),
  })
  const fakeEnKo = (impl: () => Promise<string[]>): DictionarySource<string[]> => ({
    name: 'en-ko',
    lookup: vi.fn(impl),
  })

  const service = (
    krdict = fakeKrdict(() => Promise.reject(new DictionaryError('not-found'))),
    enko = fakeEnKo(() => Promise.resolve([]))
  ) => new DictionaryService(new FreeDictionarySource(), new IdiomSource(), krdict, enko)

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
    expect(res.koTranslations).toBeNull()
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
    expect(res.koTranslations).toBeNull()
  })

  it('routes Hangul queries to krdict only', async () => {
    const entries: DictionaryResult[] = [{ word: '사과', meanings: [] }]
    const krdict = fakeKrdict(() => Promise.resolve(entries))
    const enko = fakeEnKo(() => Promise.resolve(['unused']))
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const res = await service(krdict, enko).search('사과')

    expect(res).toEqual({ dictionaryResults: entries, idiomResult: null, koTranslations: null, source: 'krdict' })
    expect(fetchSpy).not.toHaveBeenCalled() // free dictionary skipped
    expect(enko.lookup).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled() // idiom source skipped
  })

  it('routes multi-word Hangul to krdict, skipping idioms', async () => {
    const krdict = fakeKrdict(() => Promise.resolve([{ word: '사과하다', meanings: [] }]))
    const res = await service(krdict).search('사과 하다')
    expect(res.source).toBe('krdict')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('maps a Hangul not-found to the standard message', async () => {
    await expect(service().search('없는말')).rejects.toThrow(/not found/i)
  })

  it('maps a Hangul network failure to a connection message', async () => {
    const krdict = fakeKrdict(() => Promise.reject(new DictionaryError('network')))
    await expect(service(krdict).search('사과')).rejects.toThrow(/connection/i)
  })

  it('attaches koTranslations to a single-word English result', async () => {
    const entries: DictionaryResult[] = [{ word: 'apple', meanings: [] }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => entries }))
    const enko = fakeEnKo(() => Promise.resolve(['사과']))

    const res = await service(undefined, enko).search('apple')

    expect(res.koTranslations).toEqual(['사과'])
    expect(res.dictionaryResults).toEqual(entries)
    expect(res.source).toBe('free-dictionary')
  })

  it('normalizes an empty en→ko result to null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<DictionaryResult[]> => [{ word: 'apple', meanings: [] }],
      })
    )
    const res = await service().search('apple')
    expect(res.koTranslations).toBeNull()
  })

  it('still fails an English lookup when only en→ko succeeds', async () => {
    // v1 scope (documented in the spec): translations without a dictionary
    // entry do not rescue a not-found result.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const enko = fakeEnKo(() => Promise.resolve(['사과']))
    await expect(service(undefined, enko).search('apple')).rejects.toThrow(/not found/i)
  })

  it('attaches koTranslations to multi-word results without disturbing the merge', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async (): Promise<DictionaryResult[]> => [{ word: 'break the ice', meanings: [] }],
      })
    )
    invoke.mockResolvedValue({ data: { result: { term: 'break the ice', explanation: 'x' } }, error: null })
    const enko = fakeEnKo(() => Promise.resolve([]))

    const res = await service(undefined, enko).search('break the ice')

    expect(res.source).toBe('both')
    expect(res.koTranslations).toBeNull()
  })
})

describe('EnKoTranslationSource', () => {
  it('returns the Korean translations for a word, lowercased for lookup', async () => {
    maybeSingle.mockResolvedValue({ data: { ko: ['사과', '사죄'] }, error: null })

    const result = await new EnKoTranslationSource().lookup('Apple')

    expect(result).toEqual(['사과', '사죄'])
    expect(mockFrom).toHaveBeenCalledWith('en_ko_translations')
  })

  it('returns [] on a miss', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await new EnKoTranslationSource().lookup('zzzz')).toEqual([])
  })

  it('returns [] on a query error (augmentation is optional)', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: new Error('boom') })
    expect(await new EnKoTranslationSource().lookup('apple')).toEqual([])
  })

  it('returns [] when the client rejects unexpectedly', async () => {
    maybeSingle.mockRejectedValue(new Error('network'))
    expect(await new EnKoTranslationSource().lookup('apple')).toEqual([])
  })

  it('returns [] when supabase is not configured', async () => {
    expect(await new EnKoTranslationSource(null).lookup('apple')).toEqual([])
  })

  it('resolves [] when the query hangs past the timeout (never delays the main lookup)', async () => {
    vi.useFakeTimers()
    try {
      maybeSingle.mockReturnValue(new Promise(() => undefined)) // never settles
      const lookup = new EnKoTranslationSource().lookup('apple')
      await vi.advanceTimersByTimeAsync(1500)
      await expect(lookup).resolves.toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('DictionaryError', () => {
  it('exposes the failure kind', () => {
    expect(new DictionaryError('network').kind).toBe('network')
  })
})
