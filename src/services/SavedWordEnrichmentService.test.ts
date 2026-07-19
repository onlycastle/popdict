import { describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { SavedWordRecord } from '../types/savedWords'
import {
  enrichWithConcurrency,
  SavedWordEnrichmentService,
  SerialTaskQueue,
  StaleSavedWordEnrichmentError,
} from './SavedWordEnrichmentService'

const user = { id: 'user-1' } as User
const entry: SavedWordRecord = {
  id: 'word-1', word: 'bank', normalizedWord: 'bank', source: 'free-dictionary',
  createdAt: '', updatedAt: '', note: '', details: null, tags: [], review: null,
  mastery: 'new', due: true,
}
const response = {
  source: 'free-dictionary' as const,
  provenance: 'live' as const,
  dictionaryResults: [{
    word: 'bank',
    meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A financial institution.' }] }],
  }],
}

describe('SavedWordEnrichmentService', () => {
  it('does not retry a completed empty translation for the selected language', () => {
    const service = new SavedWordEnrichmentService({
      search: vi.fn(), translate: vi.fn(), readCache: vi.fn(), writeCache: vi.fn(),
      save: vi.fn(), now: () => new Date(),
    })
    expect(service.needsEnrichment({
      ...entry,
      details: {
        partOfSpeech: 'noun', definition: 'A financial institution.', example: null,
        synonyms: [], antonyms: [], translation: null, translationLanguage: 'es',
        sourceUrl: null, licenseName: null, licenseUrl: null, detailsUpdatedAt: '',
      },
    }, 'es')).toBe(false)
  })

  it('reuses cache, refreshes the selected translation, and persists in the background', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const translate = vi.fn().mockResolvedValue([{ text: 'banco', rank: 1, senseLabel: null }])
    const search = vi.fn()
    const service = new SavedWordEnrichmentService({
      search,
      translate,
      readCache: vi.fn().mockResolvedValue({
        version: 1, query: 'bank', normalizedQuery: 'bank', response, translations: {},
        savedAt: '2026-07-16T00:00:00.000Z', lastAccessedAt: '2026-07-16T00:00:00.000Z',
      }),
      writeCache: vi.fn().mockResolvedValue(undefined),
      save,
      now: () => new Date('2026-07-16T00:00:00.000Z'),
    })
    await expect(service.enrich(user, entry, 'es')).resolves.toMatchObject({
      definition: 'A financial institution.', translation: 'banco', translationLanguage: 'es',
    })
    expect(search).not.toHaveBeenCalled()
    expect(translate).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledOnce()
  })

  it('bounds network retries to two attempts', async () => {
    const search = vi.fn().mockRejectedValue(new Error('offline'))
    const service = new SavedWordEnrichmentService({
      search,
      translate: vi.fn(),
      readCache: vi.fn().mockResolvedValue(null),
      writeCache: vi.fn(),
      save: vi.fn(),
      now: () => new Date(),
    })
    await expect(service.enrich(user, entry, null)).rejects.toThrow('offline')
    expect(search).toHaveBeenCalledTimes(2)
  })

  it('does not persist a translation after its refresh generation becomes stale', async () => {
    let resolveTranslation!: (translations: { text: string; rank: number; senseLabel: null }[]) => void
    const translation = new Promise<{ text: string; rank: number; senseLabel: null }[]>((resolve) => {
      resolveTranslation = resolve
    })
    let current = true
    const save = vi.fn().mockResolvedValue(undefined)
    const translate = vi.fn().mockReturnValue(translation)
    const service = new SavedWordEnrichmentService({
      search: vi.fn(),
      translate,
      readCache: vi.fn().mockResolvedValue({
        version: 1, query: 'bank', normalizedQuery: 'bank', response, translations: {},
        savedAt: '', lastAccessedAt: '',
      }),
      writeCache: vi.fn().mockResolvedValue(undefined),
      save,
      now: () => new Date(),
    })

    const enrichment = service.enrich(user, entry, 'es', () => current)
    await vi.waitFor(() => expect(translate).toHaveBeenCalledOnce())
    current = false
    resolveTranslation([{ text: 'banco', rank: 1, senseLabel: null }])

    await expect(enrichment).rejects.toBeInstanceOf(StaleSavedWordEnrichmentError)
    expect(save).not.toHaveBeenCalled()
  })

  it('keeps phrase snapshots English-only when a translation language is selected', () => {
    const service = new SavedWordEnrichmentService({
      search: vi.fn(), translate: vi.fn(), readCache: vi.fn(), writeCache: vi.fn(),
      save: vi.fn(), now: () => new Date(),
    })
    expect(service.needsEnrichment({
      ...entry,
      word: 'break a leg',
      normalizedWord: 'break a leg',
      details: {
        partOfSpeech: 'phrase', definition: 'A wish for good luck.', example: null,
        synonyms: [], antonyms: [], translation: null, translationLanguage: null,
        sourceUrl: null, licenseName: null, licenseUrl: null, detailsUpdatedAt: '',
      },
    }, 'es')).toBe(false)
  })

  it('never runs more than two visible-row enrichments concurrently', async () => {
    let active = 0
    let peak = 0
    await enrichWithConcurrency([1, 2, 3, 4, 5], async () => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
    })
    expect(peak).toBe(2)
  })

  it('serializes writes for one word and drains the active work', async () => {
    const queue = new SerialTaskQueue()
    const order: string[] = []
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
    const first = queue.enqueue('word-1', async () => {
      order.push('first-start')
      await firstGate
      order.push('first-end')
    })
    const second = queue.enqueue('word-1', async () => {
      order.push('second')
    })
    const drained = queue.drain().then(() => order.push('drained'))

    await vi.waitFor(() => expect(order).toEqual(['first-start']))
    releaseFirst()
    await Promise.all([first, second, drained])
    expect(order).toEqual(['first-start', 'first-end', 'second', 'drained'])
  })
})
