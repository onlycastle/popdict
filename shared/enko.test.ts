import { describe, it, expect } from 'vitest'
import { extractKoTranslations, mergeTranslations, toCsvLine } from './enko'

describe('extractKoTranslations', () => {
  it('collects Korean translations from top-level and sense-level lists', () => {
    const entry = {
      word: 'apple',
      lang_code: 'en',
      translations: [
        { code: 'ko', word: '사과' },
        { code: 'ja', word: 'りんご' },
      ],
      senses: [{ translations: [{ code: 'ko', word: '사과나무' }] }],
    }
    expect(extractKoTranslations(entry)).toEqual({ word: 'apple', ko: ['사과', '사과나무'] })
  })

  it('lowercases the headword and dedupes translations preserving order', () => {
    const entry = {
      word: 'Apple',
      lang_code: 'en',
      translations: [
        { code: 'ko', word: '사과' },
        { code: 'ko', word: '사과' },
      ],
    }
    expect(extractKoTranslations(entry)).toEqual({ word: 'apple', ko: ['사과'] })
  })

  it('returns null for non-English entries', () => {
    expect(extractKoTranslations({ word: '사과', lang_code: 'ko', translations: [{ code: 'en', word: 'apple' }] })).toBeNull()
  })

  it('returns null when there are no Korean translations', () => {
    expect(extractKoTranslations({ word: 'apple', lang_code: 'en', translations: [{ code: 'ja', word: 'りんご' }] })).toBeNull()
  })

  it('returns null for junk input', () => {
    expect(extractKoTranslations(null)).toBeNull()
    expect(extractKoTranslations('nope')).toBeNull()
    expect(extractKoTranslations({ lang_code: 'en' })).toBeNull() // no word
  })

  it('skips absurdly long headwords', () => {
    expect(extractKoTranslations({ word: 'a'.repeat(41), lang_code: 'en', translations: [{ code: 'ko', word: 'x' }] })).toBeNull()
  })
})

describe('mergeTranslations', () => {
  it('appends new translations up to the cap', () => {
    const map = new Map<string, string[]>()
    mergeTranslations(map, { word: 'apple', ko: ['사과'] })
    mergeTranslations(map, { word: 'apple', ko: ['사과', '사과나무'] })
    expect(map.get('apple')).toEqual(['사과', '사과나무'])
  })

  it('caps the list', () => {
    const map = new Map<string, string[]>()
    mergeTranslations(map, { word: 'x', ko: ['1', '2', '3'] }, 2)
    expect(map.get('x')).toEqual(['1', '2'])
  })
})

describe('toCsvLine', () => {
  it('emits a CSV row with a Postgres text[] literal', () => {
    expect(toCsvLine('apple', ['사과', '사과나무'])).toBe('"apple","{""사과"",""사과나무""}"')
  })

  it('escapes quotes and backslashes inside array elements', () => {
    expect(toCsvLine('say', ['말"하"다', 'a\\b'])).toBe('"say","{""말\\""하\\""다"",""a\\\\b""}"')
  })
})
