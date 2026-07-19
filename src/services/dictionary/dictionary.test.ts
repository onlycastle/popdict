import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DictionaryResult } from '../../types/dictionary'

import { FreeDictionarySource } from './FreeDictionarySource'
import { DictionaryService } from './DictionaryService'
import { DictionaryError } from './DictionaryError'
import type { DictionarySource } from './DictionarySource'

beforeEach(() => undefined)
afterEach(() => {
  vi.unstubAllGlobals()
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
  const source = (
    name: 'free-dictionary' | 'kaikki-phrases',
    lookup: (query: string) => Promise<DictionaryResult[]>
  ): DictionarySource<DictionaryResult[]> => ({ name, lookup })
  const notFoundPhrases = source('kaikki-phrases', async () => {
    throw new DictionaryError('not-found')
  })
  const service = (
    free = new FreeDictionarySource() as DictionarySource<DictionaryResult[]>,
    phrases = notFoundPhrases
  ) => new DictionaryService(free, phrases)

  it('rejects an empty query', async () => {
    await expect(service().search('   ')).rejects.toThrow(/empty/i)
  })

  it('returns free-dictionary results for a single word', async () => {
    const entries: DictionaryResult[] = [{ word: 'hello', meanings: [] }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => entries }))

    const res = await service().search('hello')

    expect(res.source).toBe('free-dictionary')
    expect(res).toMatchObject({ dictionaryResults: entries, provenance: 'live' })
  })

  it('preserves a typed single-word network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(service().search('hello')).rejects.toMatchObject({ kind: 'network' })
  })

  it('preserves a typed single-word miss', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(service().search('asdfqwer')).rejects.toMatchObject({ kind: 'not-found' })
  })

  it('runs both phrase sources and merges successful results', async () => {
    const freeLookup = vi.fn(async () => [{
      word: 'break the ice',
      meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: 'Free definition' }] }],
    }])
    const phraseLookup = vi.fn(async () => [{
      word: 'break the ice',
      meanings: [{ partOfSpeech: 'phrase', definitions: [{ definition: 'Make people comfortable' }] }],
    }])
    const res = await service(
      source('free-dictionary', freeLookup),
      source('kaikki-phrases', phraseLookup)
    ).search('break the ice')
    expect(res.source).toBe('combined')
    expect(res.dictionaryResults?.[0].meanings).toHaveLength(2)
    expect(freeLookup).toHaveBeenCalledOnce()
    expect(phraseLookup).toHaveBeenCalledOnce()
  })

  it('returns typed not-found only when both phrase sources miss', async () => {
    const miss = async (): Promise<DictionaryResult[]> => { throw new DictionaryError('not-found') }
    await expect(service(source('free-dictionary', miss), source('kaikki-phrases', miss))
      .search('break the ice')).rejects.toMatchObject({ kind: 'not-found' })
  })

  it('prefers a typed network failure when one phrase source is unavailable', async () => {
    const offline = async (): Promise<DictionaryResult[]> => { throw new DictionaryError('network') }
    await expect(service(source('free-dictionary', offline), notFoundPhrases)
      .search('break the ice')).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('DictionaryError', () => {
  it('exposes the failure kind', () => {
    expect(new DictionaryError('network').kind).toBe('network')
  })
})
