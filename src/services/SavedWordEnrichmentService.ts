import type { User } from '@supabase/supabase-js'
import { normalizeEnglishWord, type TargetLanguage, type WordTranslation } from '../../shared/language'
import type { CachedLookup, SearchResponse } from '../types/dictionary'
import type { SavedWordDetails, SavedWordRecord } from '../types/savedWords'
import { savedWordDetailsFromLookup } from './savedWordDetails'
import { dictionaryService } from './dictionary'
import { savedWords } from './SavedWordsRepository'
import { translationService } from './TranslationService'

type EnrichmentDeps = {
  search: (query: string) => Promise<SearchResponse>
  translate: (word: string, language: TargetLanguage) => Promise<WordTranslation[]>
  readCache: (query: string) => Promise<CachedLookup | null>
  writeCache: (input: {
    query: string
    response: SearchResponse
    translationLanguage?: TargetLanguage | null
    translations?: WordTranslation[]
  }) => Promise<void>
  save: (user: User, savedWordId: string, details: SavedWordDetails) => Promise<void>
  now: () => Date
}

export class StaleSavedWordEnrichmentError extends Error {
  constructor() {
    super('Saved-word enrichment was superseded by a newer refresh.')
    this.name = 'StaleSavedWordEnrichmentError'
  }
}

export class SerialTaskQueue {
  private pending = new Map<string, Promise<void>>()

  enqueue(key: string, task: () => Promise<void>): Promise<void> {
    const previous = this.pending.get(key) ?? Promise.resolve()
    const current = previous
      .catch((): void => undefined)
      .then(task)
      .finally(() => {
        if (this.pending.get(key) === current) this.pending.delete(key)
      })
    this.pending.set(key, current)
    return current
  }

  async drain(): Promise<void> {
    await Promise.allSettled([...this.pending.values()])
  }
}

async function retry<T>(task: () => Promise<T>, attempts = 2): Promise<T> {
  let failure: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      failure = error
    }
  }
  throw failure
}

export class SavedWordEnrichmentService {
  constructor(private deps: EnrichmentDeps) {}

  needsEnrichment(entry: SavedWordRecord, language: TargetLanguage | null): boolean {
    const desiredLanguage = normalizeEnglishWord(entry.word) ? language : null
    return entry.details === null || entry.details.translationLanguage !== desiredLanguage
  }

  async enrich(
    user: User,
    entry: SavedWordRecord,
    language: TargetLanguage | null,
    isCurrent: () => boolean = () => true,
  ): Promise<SavedWordDetails> {
    const assertCurrent = () => {
      if (!isCurrent()) throw new StaleSavedWordEnrichmentError()
    }
    assertCurrent()
    const desiredLanguage = normalizeEnglishWord(entry.word) ? language : null
    if (!this.needsEnrichment(entry, desiredLanguage) && entry.details) return entry.details
    const cached = await this.deps.readCache(entry.word).catch((): null => null)
    assertCurrent()
    let response: SearchResponse | null = cached?.response ?? null
    if (!response && entry.details === null) {
      response = await retry(() => this.deps.search(entry.word))
      assertCurrent()
      await this.deps.writeCache({ query: entry.word, response }).catch((): undefined => undefined)
      assertCurrent()
    }

    let translations: WordTranslation[] = []
    const canonical = normalizeEnglishWord(response?.dictionaryResults?.[0]?.word ?? entry.word)
    if (desiredLanguage && canonical) {
      const fromCache = cached?.translations[desiredLanguage]
      translations = fromCache ?? await retry(() => this.deps.translate(canonical, desiredLanguage))
      assertCurrent()
    }

    let details = response ? savedWordDetailsFromLookup({
      response,
      language: desiredLanguage,
      translations,
      translationComplete: true,
      now: this.deps.now(),
    }) : null
    if (!details && entry.details) {
      details = {
        ...entry.details,
        translation: translations[0]?.text ?? null,
        translationLanguage: desiredLanguage,
        detailsUpdatedAt: this.deps.now().toISOString(),
      }
    }
    if (!details) throw new Error('No details are available for this saved word.')
    assertCurrent()
    await this.deps.save(user, entry.id, details)
    assertCurrent()
    if (response && desiredLanguage) {
      await this.deps.writeCache({
        query: entry.word,
        response,
        translationLanguage: desiredLanguage,
        translations,
      }).catch((): undefined => undefined)
      assertCurrent()
    }
    return details
  }
}

export async function enrichWithConcurrency<T>(
  entries: T[],
  worker: (entry: T) => Promise<void>,
  concurrency = 2
): Promise<void> {
  let index = 0
  const run = async () => {
    while (index < entries.length) {
      const current = entries[index]
      index += 1
      await worker(current)
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(Math.max(1, concurrency), entries.length) },
    () => run()
  ))
}

export const savedWordEnrichment = new SavedWordEnrichmentService({
  search: (query) => dictionaryService.search(query),
  translate: (word, language) => translationService.lookup(word, language),
  readCache: (query) => window.electronAPI.readLookupCache(query),
  writeCache: (input) => window.electronAPI.writeLookupCache(input),
  save: (user, savedWordId, details) => savedWords.updateDetails(user, savedWordId, details),
  now: () => new Date(),
})
