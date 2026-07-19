import { describe, expect, it } from 'vitest'
import { baseFormSuggestions, mergeRecoverySuggestions, wiktionarySearchUrl } from './recovery'

describe('lookup recovery', () => {
  it('generates deterministic plural and tense base forms', () => {
    expect(baseFormSuggestions('studies')).toContain('study')
    expect(baseFormSuggestions('walked')).toContain('walk')
    expect(baseFormSuggestions('stopping')).toContain('stop')
    expect(baseFormSuggestions('boxes')).toContain('box')
  })

  it('deduplicates native and base-form suggestions to five safe words', () => {
    expect(mergeRecoverySuggestions('studies', [
      'study', 'Study', 'student', 'studdies', 'studios', 'unsafe phrase',
    ])).toEqual(['study', 'student', 'studdies', 'studios', 'studie'])
  })

  it('builds an encoded Wiktionary recovery URL', () => {
    expect(wiktionarySearchUrl('break the ice')).toContain('search=break+the+ice')
  })
})
