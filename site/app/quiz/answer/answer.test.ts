import { describe, expect, it } from 'vitest'
import { parseAnswerParams, resultPath } from './answer'

const UUID = '123e4567-e89b-42d3-a456-426614174000'

describe('parseAnswerParams', () => {
  it('accepts a uuid question id and a choice 0-3', () => {
    expect(parseAnswerParams(new URLSearchParams({ q: UUID, c: '2' }))).toEqual({ q: UUID, c: 2 })
  })
  it.each([
    ['missing q', { c: '1' }],
    ['non-uuid q', { q: 'abc', c: '1' }],
    ['choice out of range', { q: UUID, c: '4' }],
    ['non-numeric choice', { q: UUID, c: 'x' }],
    ['missing c', { q: UUID }],
    ['empty c', { q: UUID, c: '' }],
  ])('rejects %s', (_label, params) => {
    expect(parseAnswerParams(new URLSearchParams(params as Record<string, string>))).toBeNull()
  })
})

describe('resultPath', () => {
  it('encodes an outcome', () => {
    expect(resultPath({ word: 'apple', correct: true, correctAnswer: '사과', streak: 3 }))
      .toBe('/quiz/result?word=apple&correct=1&answer=%EC%82%AC%EA%B3%BC&streak=3')
  })
  it('encodes an error', () => {
    expect(resultPath({ error: 'invalid' })).toBe('/quiz/result?error=invalid')
  })
})
