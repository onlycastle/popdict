import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { TargetLanguage, WordTranslation } from '../shared/language'
import { isTargetLanguage } from '../shared/language'
import type {
  CachedLookup,
  Definition,
  DictionaryAttribution,
  DictionaryLicense,
  DictionaryResult,
  Meaning,
  SearchResponse,
} from '../src/types/dictionary'

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

function withinEntryLimit(value: unknown): boolean {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_ENTRY_BYTES
  } catch {
    return false
  }
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
        (item.senseLabel === null || (
          typeof item.senseLabel === 'string' && item.senseLabel.length <= 100
        ))
        ? [{ text: item.text, rank: item.rank as number, senseLabel: item.senseLabel ?? null }]
        : []
    }).slice(0, 3)
  }
  return output
}

function boundedString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === 'string'
    && value.length <= maxLength
    && (allowEmpty || value.trim().length > 0)
}

function httpUrl(value: unknown): value is string {
  if (!boundedString(value, 2_048)) return false
  try {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= 100
    && value.every((item) => boundedString(item, 300))
}

function sanitizeLicense(value: unknown): DictionaryLicense | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const license = value as Partial<DictionaryLicense>
  return boundedString(license.name, 160) && httpUrl(license.url)
    ? { name: license.name, url: license.url }
    : null
}

function sanitizeAttribution(value: unknown): DictionaryAttribution | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const attribution = value as Partial<DictionaryAttribution>
  if (!boundedString(attribution.label, 160)) return null
  if (attribution.sourceUrl !== undefined && !httpUrl(attribution.sourceUrl)) return null
  const license = attribution.license === undefined
    ? undefined : sanitizeLicense(attribution.license)
  if (attribution.license !== undefined && !license) return null
  return {
    label: attribution.label,
    ...(attribution.sourceUrl === undefined ? {} : { sourceUrl: attribution.sourceUrl }),
    ...(license === undefined ? {} : { license }),
  }
}

function sanitizeDefinition(value: unknown): Definition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const definition = value as Partial<Definition>
  if (!boundedString(definition.definition, 20_000)) return null
  if (definition.example !== undefined && !boundedString(definition.example, 20_000)) return null
  if (definition.synonyms !== undefined && !stringArray(definition.synonyms)) return null
  if (definition.antonyms !== undefined && !stringArray(definition.antonyms)) return null
  if (definition.usageLabels !== undefined && !stringArray(definition.usageLabels)) return null
  return {
    definition: definition.definition,
    ...(definition.example === undefined ? {} : { example: definition.example }),
    ...(definition.synonyms === undefined ? {} : { synonyms: [...definition.synonyms] }),
    ...(definition.antonyms === undefined ? {} : { antonyms: [...definition.antonyms] }),
    ...(definition.usageLabels === undefined ? {} : { usageLabels: [...definition.usageLabels] }),
  }
}

function sanitizeMeaning(value: unknown): Meaning | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const meaning = value as Partial<Meaning>
  if (!boundedString(meaning.partOfSpeech, 160)) return null
  if (!Array.isArray(meaning.definitions) || meaning.definitions.length === 0) return null
  const definitions = meaning.definitions.map(sanitizeDefinition)
  if (definitions.some((definition) => definition === null)) return null
  return { partOfSpeech: meaning.partOfSpeech, definitions: definitions as Definition[] }
}

function sanitizeResult(value: unknown): DictionaryResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value as Partial<DictionaryResult>
  if (!boundedString(result.word, 300)) return null
  if (!Array.isArray(result.meanings) || result.meanings.length === 0) return null
  const meanings = result.meanings.map(sanitizeMeaning)
  if (meanings.some((meaning) => meaning === null)) return null
  if (result.phonetic !== undefined && !boundedString(result.phonetic, 300, true)) return null
  if (result.origin !== undefined && !boundedString(result.origin, 20_000, true)) return null
  if (result.sourceUrls !== undefined && (
    !Array.isArray(result.sourceUrls) || result.sourceUrls.length > 20 ||
    !result.sourceUrls.every(httpUrl)
  )) return null
  if (result.attributions !== undefined && (
    !Array.isArray(result.attributions) || result.attributions.length > 20
  )) return null
  const attributions = result.attributions?.map(sanitizeAttribution)
  if (attributions?.some((attribution) => attribution === null)) return null
  const license = result.license === undefined ? undefined : sanitizeLicense(result.license)
  if (result.license !== undefined && !license) return null
  if (result.phonetics !== undefined && (
    !Array.isArray(result.phonetics) || result.phonetics.length > 100
  )) return null
  const phonetics = result.phonetics?.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const phonetic = value as NonNullable<DictionaryResult['phonetics']>[number]
    if (phonetic.text !== undefined && !boundedString(phonetic.text, 300, true)) return null
    if (phonetic.audio !== undefined && phonetic.audio !== '' && !httpUrl(phonetic.audio)) return null
    if (phonetic.sourceUrl !== undefined && !httpUrl(phonetic.sourceUrl)) return null
    const phoneticLicense = phonetic.license === undefined
      ? undefined : sanitizeLicense(phonetic.license)
    if (phonetic.license !== undefined && !phoneticLicense) return null
    return {
      ...(phonetic.text === undefined ? {} : { text: phonetic.text }),
      ...(phonetic.audio === undefined ? {} : { audio: phonetic.audio }),
      ...(phonetic.sourceUrl === undefined ? {} : { sourceUrl: phonetic.sourceUrl }),
      ...(phoneticLicense === undefined ? {} : { license: phoneticLicense }),
    }
  })
  if (phonetics?.some((phonetic) => phonetic === null)) return null
  return {
    word: result.word,
    meanings: meanings as Meaning[],
    ...(result.phonetic === undefined ? {} : { phonetic: result.phonetic }),
    ...(phonetics === undefined ? {} : {
      phonetics: phonetics as NonNullable<DictionaryResult['phonetics']>,
    }),
    ...(result.origin === undefined ? {} : { origin: result.origin }),
    ...(license === undefined ? {} : { license }),
    ...(result.sourceUrls === undefined ? {} : { sourceUrls: [...result.sourceUrls] }),
    ...(attributions === undefined ? {} : {
      attributions: attributions as DictionaryAttribution[],
    }),
  }
}

function validResponse(value: unknown): SearchResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const response = value as Partial<SearchResponse>
  if (!['free-dictionary', 'kaikki-phrases', 'combined'].includes(response.source ?? '')) return null
  if (!Array.isArray(response.dictionaryResults) || response.dictionaryResults.length === 0) return null
  const dictionaryResults = response.dictionaryResults.map(sanitizeResult)
  if (dictionaryResults.some((result) => result === null)) return null
  const sanitized = {
    dictionaryResults: dictionaryResults as DictionaryResult[],
    source: response.source,
    provenance: 'live' as const,
  } as SearchResponse
  return withinEntryLimit(sanitized)
    ? sanitized
    : null
}

function validEntry(value: unknown, nowMs: number): CachedLookup | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !withinEntryLimit(value)) return null
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
  const sanitized: CachedLookup = {
    version: CACHE_VERSION,
    query: typeof entry.query === 'string' ? entry.query.slice(0, 160) : normalizedQuery,
    normalizedQuery,
    response,
    translations: validTranslations(entry.translations),
    savedAt: new Date(savedAtMs).toISOString(),
    lastAccessedAt: new Date(accessedAtMs).toISOString(),
  }
  return withinEntryLimit(sanitized) ? sanitized : null
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
      if (!withinEntryLimit(input)) return
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
      if (!withinEntryLimit(next)) return
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
