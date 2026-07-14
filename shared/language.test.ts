import { describe, expect, it } from 'vitest'
import { isTargetLanguage, normalizeEnglishWord, TARGET_LANGUAGES } from './language'

describe('target languages', () => {
  it('contains exactly the five release languages', () => {
    expect(TARGET_LANGUAGES).toEqual(['ko', 'ja', 'zh-Hans', 'es', 'pt-BR'])
    expect(TARGET_LANGUAGES.every(isTargetLanguage)).toBe(true)
  })

  it('normalizes a canonical single English word and rejects phrases', () => {
    expect(normalizeEnglishWord(' Bank ')).toBe('bank')
    expect(normalizeEnglishWord('mother-in-law')).toBe('mother-in-law')
    expect(normalizeEnglishWord('don’t')).toBe("don't")
    expect(normalizeEnglishWord('break the ice')).toBeNull()
    expect(normalizeEnglishWord('銀行')).toBeNull()
  })
})
