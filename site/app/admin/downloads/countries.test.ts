import { describe, expect, it } from 'vitest'
import { countryDisplayName, countryShade, flagEmoji, rankCountries } from './countries'

describe('flagEmoji', () => {
  it('maps alpha-2 codes to regional-indicator flags', () => {
    expect(flagEmoji('KR')).toBe('🇰🇷')
    expect(flagEmoji('US')).toBe('🇺🇸')
  })

  it('returns empty string for anything that is not two capital letters', () => {
    expect(flagEmoji('unknown')).toBe('')
    expect(flagEmoji('K')).toBe('')
    expect(flagEmoji('KOR')).toBe('')
  })
})

describe('countryDisplayName', () => {
  it('resolves English region names with raw-code fallback', () => {
    expect(countryDisplayName('KR')).toBe('South Korea')
    expect(countryDisplayName('unknown')).toBe('Unknown')
    expect(countryDisplayName('AB')).toBe('AB')
    expect(countryDisplayName('<img>')).toBe('<img>')
  })
})

describe('rankCountries', () => {
  it('sorts by count desc with unknown last and drops zeros', () => {
    const rows = rankCountries({ US: 6, unknown: 9, KR: 11, JP: 6, DE: 0 })
    expect(rows.map((row) => row.code)).toEqual(['KR', 'JP', 'US', 'unknown'])
    expect(rows[0]).toEqual({ code: 'KR', name: 'South Korea', flag: '🇰🇷', count: 11 })
    expect(rows[3].flag).toBe('—')
  })
})

describe('countryShade', () => {
  it('quantizes into four amber shades and neutral for zero', () => {
    expect(countryShade(0, 10)).toBe('#eee8df')
    expect(countryShade(10, 10)).toBe('#d9862f')
    expect(countryShade(1, 10)).toBe('#f6d9b8')
    expect(countryShade(5, 10)).toBe('#e39a4e')
  })
})
