import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchReview, parseAnswerParams, resultPath } from './answer'

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
  it('encodes the question uuid on success', () => {
    expect(resultPath({ q: UUID, word: 'apple', correct: true, correctAnswer: '사과', streak: 3 }))
      .toBe(`/quiz/result?q=${UUID}`)
  })
  it('encodes an error', () => {
    expect(resultPath({ error: 'invalid' })).toBe('/quiz/result?error=invalid')
  })
})

describe('fetchReview', () => {
  const ORIGINAL_ENV = process.env.QUIZ_FN_URL

  afterEach(() => {
    process.env.QUIZ_FN_URL = ORIGINAL_ENV
    vi.unstubAllGlobals()
  })

  it('hits the review action and returns the parsed body', async () => {
    process.env.QUIZ_FN_URL = 'https://fn.example.com/quiz'
    const body = {
      word: 'apple',
      correct: true,
      correctAnswer: '사과',
      streak: 3,
      material: { definition: 'a fruit', examples: ['I ate an apple.'], similar: [] },
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) })
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchReview(UUID)).toEqual(body)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://fn.example.com/quiz?action=review&q=${UUID}`,
      { cache: 'no-store' },
    )
  })

  it('returns null when the response is not ok', async () => {
    process.env.QUIZ_FN_URL = 'https://fn.example.com/quiz'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))
    expect(await fetchReview(UUID)).toBeNull()
  })

  it('returns null for a non-uuid q without calling fetch', async () => {
    process.env.QUIZ_FN_URL = 'https://fn.example.com/quiz'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchReview('not-a-uuid')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when QUIZ_FN_URL is unset', async () => {
    delete process.env.QUIZ_FN_URL
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchReview(UUID)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
