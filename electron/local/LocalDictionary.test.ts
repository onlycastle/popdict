import { mkdtemp, rm, readFile } from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { LocalDictionary } from './LocalDictionary'

let dir: string
let dictionary: LocalDictionary
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'popdict-dictionary-'))
  dictionary = new LocalDictionary(path.resolve('data/offline'), dir)
})
afterAll(async () => { await rm(dir, { recursive: true, force: true }) })
describe('bundled dictionary with network disabled and no lookup history', () => {
  it('opens the shipped compressed database and resolves ordinary words and function words', async () => {
    vi.stubGlobal('fetch', () => { throw new Error('Network forbidden') })
    try {
      for (const word of ['hello', 'world', 'apple', 'book', 'the', 'and', 'is', 'tactile']) {
        const rows = await dictionary.lookup(word)
        expect(rows.length, word).toBeGreaterThan(0)
        expect(rows[0].meanings[0].definitions[0].definition, word).toBeTruthy()
        expect(rows[0].attributions?.[0].license).toBeTruthy()
      }
    } finally { vi.unstubAllGlobals() }
  }, 30_000)
  it('covers every bundled learner headword without a network fallback', async () => {
    const words = (await readFile('data/translations/ngsl-gr-5049.txt', 'utf8')).trim().split('\n')
    for (const word of words) expect((await dictionary.lookup(word)).length, word).toBeGreaterThan(0)
  }, 30_000)
  it('resolves phrases and known irregular forms', async () => {
    expect((await dictionary.lookup('break the ice'))[0].meanings.length).toBeGreaterThan(0)
    expect((await dictionary.lookup('went'))[0].word.toLowerCase()).toBe('go')
    expect((await dictionary.lookup('children'))[0].word.toLowerCase()).toBe('child')
  })
  it('reads translations locally and does not fabricate unknown words', async () => {
    expect((await dictionary.translate('hello', 'ko')).length).toBeGreaterThan(0)
    expect(await dictionary.lookup('asdlkfjqwerzzzz')).toEqual([])
    expect(await dictionary.translate('hello', 'xx')).toEqual([])
    expect(await dictionary.lookup('x'.repeat(161))).toEqual([])
  })
  it('reopens the installed dictionary using the manifest', async () => {
    const restarted = new LocalDictionary(path.resolve('data/offline'), dir)
    expect((await restarted.lookup('hello'))[0].word).toBeTruthy()
  })
})
