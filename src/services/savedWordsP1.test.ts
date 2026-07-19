import { describe, expect, it } from 'vitest'
import { savedWordDetailsFromLookup } from './savedWordDetails'
import { filterSavedWords, isReviewDue, masteryForBox } from './savedWordFilters'
import { savedWordsCsv } from './savedWordsCsv'
import type { SavedWordRecord } from '../types/savedWords'

const record = (overrides: Partial<SavedWordRecord> = {}): SavedWordRecord => ({
  id: 'word-1',
  word: 'bank',
  normalizedWord: 'bank',
  source: 'free-dictionary',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  note: '',
  details: null,
  tags: [],
  review: null,
  mastery: 'new',
  due: true,
  ...overrides,
})

describe('Saved Words 2.0 pure behavior', () => {
  it('captures the first definition, first available example, related words, translation, and attribution', () => {
    expect(savedWordDetailsFromLookup({
      response: {
        source: 'free-dictionary',
        provenance: 'live',
        dictionaryResults: [{
          word: 'bank',
          meanings: [{ partOfSpeech: 'noun', definitions: [
            { definition: 'A financial institution.', synonyms: ['lender'] },
            { definition: 'A river edge.', example: 'We sat on the bank.', antonyms: ['channel'] },
          ] }],
          sourceUrls: ['https://example.test/bank'],
          license: { name: 'CC', url: 'https://example.test/license' },
        }],
      },
      language: 'es',
      translations: [{ text: 'banco', rank: 1, senseLabel: null }],
      now: new Date('2026-07-16T00:00:00.000Z'),
    })).toMatchObject({
      partOfSpeech: 'noun',
      definition: 'A financial institution.',
      example: 'We sat on the bank.',
      synonyms: ['lender'],
      antonyms: ['channel'],
      translation: 'banco',
      translationLanguage: 'es',
      sourceUrl: 'https://example.test/bank',
    })
  })

  it('applies New/Learning/Mastered and Due definitions exactly', () => {
    expect([masteryForBox(null), masteryForBox(1), masteryForBox(4), masteryForBox(5)])
      .toEqual(['new', 'learning', 'learning', 'mastered'])
    expect(isReviewDue(null)).toBe(true)
    expect(isReviewDue('2026-07-15T00:00:00.000Z', new Date('2026-07-16T00:00:00.000Z')))
      .toBe(true)
    expect(isReviewDue('2026-07-17T00:00:00.000Z', new Date('2026-07-16T00:00:00.000Z')))
      .toBe(false)
  })

  it('filters by due, mastery, and normalized tag', () => {
    const words = [
      record(),
      record({ id: '2', word: 'bus', normalizedWord: 'bus', mastery: 'learning', due: false }),
      record({
        id: '3', word: 'house', normalizedWord: 'house', mastery: 'mastered',
        tags: [{ id: 't', savedWordId: '3', tag: 'Travel', normalizedTag: 'travel', createdAt: '' }],
      }),
    ]
    expect(filterSavedWords(words, 'due', '')).toHaveLength(2)
    expect(filterSavedWords(words, 'learning', '')[0].word).toBe('bus')
    expect(filterSavedWords(words, 'tag:travel', '')[0].word).toBe('house')
  })

  it('exports UTF-8 RFC 4180 CSV with quoting and all required columns', () => {
    const csv = savedWordsCsv([record({
      note: 'Line one\n"quoted"',
      details: {
        partOfSpeech: 'noun', definition: 'A bank, or lender', example: null,
        synonyms: [], antonyms: [], translation: 'banco', translationLanguage: 'es',
        sourceUrl: null, licenseName: null, licenseUrl: null,
        detailsUpdatedAt: '2026-07-16T00:00:00.000Z',
      },
    })])
    expect(csv.startsWith('\uFEFFword,part_of_speech')).toBe(true)
    expect(csv).toContain('"A bank, or lender"')
    expect(csv).toContain('"Line one\n""quoted"""')
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})
