import { describe, it, expect } from 'vitest'
import { containsHangul } from './lang'

describe('containsHangul', () => {
  it('detects complete Hangul syllables', () => {
    expect(containsHangul('사과')).toBe(true)
  })

  it('detects standalone jamo (as typed mid-composition)', () => {
    expect(containsHangul('ㅅ')).toBe(true)
    expect(containsHangul('ㅏ')).toBe(true)
  })

  it('detects Hangul mixed with Latin', () => {
    expect(containsHangul('사과 apple')).toBe(true)
  })

  it('rejects pure Latin', () => {
    expect(containsHangul('apple')).toBe(false)
  })

  it('rejects other CJK scripts', () => {
    expect(containsHangul('林檎')).toBe(false) // Japanese/Chinese
    expect(containsHangul('りんご')).toBe(false) // Hiragana
  })

  it('rejects empty and whitespace', () => {
    expect(containsHangul('')).toBe(false)
    expect(containsHangul('   ')).toBe(false)
  })
})
