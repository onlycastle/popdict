import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LookupCache } from './lookupCache'

const dirs: string[] = []
async function fixture(now = new Date('2026-07-16T00:00:00.000Z')) {
  const dir = await mkdtemp(join(tmpdir(), 'popdict-cache-'))
  dirs.push(dir)
  const path = join(dir, 'lookup-cache-v1.json')
  return { cache: new LookupCache(path, () => now), path }
}
const response = (word: string) => ({
  dictionaryResults: [{ word, meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: word }] }] }],
  source: 'free-dictionary' as const,
  provenance: 'live' as const,
})

afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))))

describe('LookupCache', () => {
  it('round-trips complete definitions and matching-language translations', async () => {
    const { cache } = await fixture()
    await cache.write({
      query: 'Bank',
      response: response('bank'),
      translationLanguage: 'es',
      translations: [{ text: 'banco', rank: 1, senseLabel: 'finance' }],
    })
    await expect(cache.read(' bank ')).resolves.toMatchObject({
      normalizedQuery: 'bank',
      response: { dictionaryResults: [{ word: 'bank' }] },
      translations: { es: [{ text: 'banco' }] },
    })
  })

  it('expires entries after 90 days', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z')
    const { path } = await fixture(start)
    await new LookupCache(path, () => start).write({ query: 'old', response: response('old') })
    await expect(new LookupCache(path, () => new Date('2026-04-02T00:00:00.001Z')).read('old'))
      .resolves.toBeNull()
  })

  it('keeps the 100 most recently used entries', async () => {
    let tick = 0
    const { path } = await fixture()
    const cache = new LookupCache(path, () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)))
    for (let index = 0; index < 101; index += 1) {
      await cache.write({ query: `word ${index}`, response: response(`word ${index}`) })
    }
    await expect(cache.read('word 0')).resolves.toBeNull()
    await expect(cache.read('word 100')).resolves.not.toBeNull()
  })

  it('discards corrupt and oversized entries safely', async () => {
    const { cache, path } = await fixture()
    await writeFile(path, '{bad')
    await expect(cache.read('word')).resolves.toBeNull()
    await writeFile(path, JSON.stringify({
      version: 1,
      entries: [{
        version: 1,
        query: 'huge',
        normalizedQuery: 'huge',
        response: {
          dictionaryResults: [{ word: 'huge', meanings: [], origin: 'x'.repeat(600_000) }],
          source: 'free-dictionary',
          provenance: 'live',
        },
        translations: {},
        savedAt: '2026-07-16T00:00:00.000Z',
        lastAccessedAt: '2026-07-16T00:00:00.000Z',
      }],
    }))
    await expect(cache.read('huge')).resolves.toBeNull()
    expect(JSON.parse(await readFile(path, 'utf8')).entries).toEqual([])
  })
})
