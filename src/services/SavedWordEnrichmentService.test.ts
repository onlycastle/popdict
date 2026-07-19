import { describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { SavedWordRecord } from '../types/savedWords'
import { enrichWithConcurrency, SavedWordEnrichmentService } from './SavedWordEnrichmentService'

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
})
