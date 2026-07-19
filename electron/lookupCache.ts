import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { TargetLanguage, WordTranslation } from '../shared/language'
import { isTargetLanguage } from '../shared/language'
import type { CachedLookup, SearchResponse } from '../src/types/dictionary'

const CACHE_VERSION = 1 as const
const MAX_ENTRIES = 100
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_ENTRY_BYTES = 512 * 1024

type CacheFile = { version: 1; entries: CachedLookup[] }
export type LookupCacheWrite = {
  query: string
  response: SearchResponse
  translationLanguage?: TargetLanguage | null
  translations?: WordTranslation[]
}

export function normalizeLookupCacheKey(value: string): string {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 160)
    : ''
}

function validTranslations(value: unknown): CachedLookup['translations'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const output: CachedLookup['translations'] = {}
  for (const [language, rows] of Object.entries(value)) {
    if (!isTargetLanguage(language) || !Array.isArray(rows)) continue
    output[language] = rows.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const item = row as Partial<WordTranslation>
      return typeof item.text === 'string' && item.text.length <= 120 &&
        Number.isInteger(item.rank) && (item.rank ?? 0) >= 1 && (item.rank ?? 0) <= 3 &&
        (item.senseLabel === null || typeof item.senseLabel === 'string')
        ? [{ text: item.text, rank: item.rank as number, senseLabel: item.senseLabel ?? null }]
        : []
    }).slice(0, 3)
  }
  return output
}

function validResponse(value: unknown): SearchResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const response = value as Partial<SearchResponse>
  if (!['free-dictionary', 'kaikki-phrases', 'combined'].includes(response.source ?? '')) return null
  if (!Array.isArray(response.dictionaryResults) || response.dictionaryResults.length === 0) return null
  const sanitized = {
    dictionaryResults: response.dictionaryResults,
    source: response.source,
    provenance: 'live' as const,
  } as SearchResponse
  return Buffer.byteLength(JSON.stringify(sanitized), 'utf8') <= MAX_ENTRY_BYTES
    ? sanitized
    : null
}

function validEntry(value: unknown, nowMs: number): CachedLookup | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entry = value as Partial<CachedLookup>
  const normalizedQuery = normalizeLookupCacheKey(entry.normalizedQuery ?? entry.query ?? '')
  const response = validResponse(entry.response)
  const savedAtMs = Date.parse(entry.savedAt ?? '')
  const accessedAtMs = Date.parse(entry.lastAccessedAt ?? '')
  if (
    entry.version !== CACHE_VERSION || !normalizedQuery || !response ||
    !Number.isFinite(savedAtMs) || !Number.isFinite(accessedAtMs) ||
    savedAtMs > nowMs + 60_000 || nowMs - savedAtMs > MAX_AGE_MS
  ) return null
  return {
    version: CACHE_VERSION,
    query: typeof entry.query === 'string' ? entry.query.slice(0, 160) : normalizedQuery,
    normalizedQuery,
    response,
    translations: validTranslations(entry.translations),
    savedAt: new Date(savedAtMs).toISOString(),
    lastAccessedAt: new Date(accessedAtMs).toISOString(),
  }
}

export class LookupCache {
  private operation = Promise.resolve()

  constructor(
    private filePath: string,
    private now: () => Date = () => new Date()
  ) {}

  read(query: string): Promise<CachedLookup | null> {
    return this.enqueue(async () => {
      const key = normalizeLookupCacheKey(query)
      if (!key) return null
      const file = await this.load()
      const entry = file.entries.find((item) => item.normalizedQuery === key)
      if (!entry) return null
      entry.lastAccessedAt = this.now().toISOString()
      await this.save(file)
      return structuredClone(entry)
    })
  }

  write(input: LookupCacheWrite): Promise<void> {
    return this.enqueue(async () => {
      const key = normalizeLookupCacheKey(input.query)
      const response = validResponse(input.response)
      if (!key || !response) return
      const now = this.now().toISOString()
      const file = await this.load()
      const existing = file.entries.find((entry) => entry.normalizedQuery === key)
      const translations = { ...(existing?.translations ?? {}) }
      if (input.translationLanguage && Array.isArray(input.translations)) {
        translations[input.translationLanguage] = validTranslations({
          [input.translationLanguage]: input.translations,
        })[input.translationLanguage] ?? []
      }
      const next: CachedLookup = {
        version: CACHE_VERSION,
        query: input.query.trim().slice(0, 160),
        normalizedQuery: key,
        response,
        translations,
        savedAt: now,
        lastAccessedAt: now,
      }
      file.entries = [
        next,
        ...file.entries.filter((entry) => entry.normalizedQuery !== key),
      ]
        .sort((a, b) => Date.parse(b.lastAccessedAt) - Date.parse(a.lastAccessedAt))
        .slice(0, MAX_ENTRIES)
      await this.save(file)
    })
  }

  clear(): Promise<void> {
    return this.enqueue(async () => {
      await fs.rm(this.filePath, { force: true })
      await fs.rm(`${this.filePath}.tmp`, { force: true })
    })
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.operation.then(task, task)
    this.operation = next.then((): undefined => undefined, (): undefined => undefined)
    return next
  }

  private async load(): Promise<CacheFile> {
    const nowMs = this.now().getTime()
    try {
      const stats = await fs.stat(this.filePath)
      if (stats.size > MAX_FILE_BYTES) {
        await fs.rm(this.filePath, { force: true })
        return { version: CACHE_VERSION, entries: [] }
      }
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as Partial<CacheFile>
      if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.entries)) {
        throw new Error('invalid cache')
      }
      const file: CacheFile = {
        version: CACHE_VERSION,
        entries: parsed.entries
          .map((entry) => validEntry(entry, nowMs))
          .filter((entry): entry is CachedLookup => entry !== null)
          .sort((a, b) => Date.parse(b.lastAccessedAt) - Date.parse(a.lastAccessedAt))
          .slice(0, MAX_ENTRIES),
      }
      if (file.entries.length !== parsed.entries.length) await this.save(file)
      return file
    } catch {
      await fs.rm(this.filePath, { force: true }).catch((): undefined => undefined)
      return { version: CACHE_VERSION, entries: [] }
    }
  }

  private async save(file: CacheFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.tmp`
    await fs.writeFile(temporary, `${JSON.stringify(file)}\n`, 'utf8')
    await fs.rename(temporary, this.filePath)
  }
}
