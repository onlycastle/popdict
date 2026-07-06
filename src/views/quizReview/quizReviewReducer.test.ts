import { describe, expect, it } from 'vitest'
import type { AnswerResult, SessionCard } from '../../services/QuizSessionService'
import { initialQuizReviewState, quizReviewReducer } from './quizReviewReducer'

const card = (id: string): SessionCard => ({ questionId: id, kind: 'recognition', prompt: id, options: ['a', 'b', 'c', 'd'] })
const result = (over: Partial<AnswerResult> = {}): AnswerResult => ({
  word: 'W', correct: true, correctAnswer: 'a', streak: 4, alreadyAnswered: false, material: null, ...over,
})

describe('quizReviewReducer', () => {
  it('loaded with cards → question at index 0', () => {
    const s = quizReviewReducer(initialQuizReviewState, { type: 'loaded', cards: [card('q1'), card('q2')] })
    expect(s).toMatchObject({ phase: 'question', index: 0, correctSoFar: 0, answering: false })
  })

  it('loaded with no cards → empty', () => {
    expect(quizReviewReducer(initialQuizReviewState, { type: 'loaded', cards: [] }).phase).toBe('empty')
  })

  it('load_failed → error', () => {
    const s = quizReviewReducer(initialQuizReviewState, { type: 'load_failed', message: 'offline' })
    expect(s).toEqual({ phase: 'error', message: 'offline' })
  })

  it('choose sets answering; answer_failed rolls back', () => {
    let s = quizReviewReducer(initialQuizReviewState, { type: 'loaded', cards: [card('q1')] })
    s = quizReviewReducer(s, { type: 'choose', index: 1 })
    expect(s).toMatchObject({ phase: 'question', answering: true })
    s = quizReviewReducer(s, { type: 'answer_failed' })
    expect(s).toMatchObject({ phase: 'question', answering: false })
  })

  it('answered → revealed, incrementing correctSoFar on a correct answer', () => {
    let s = quizReviewReducer(initialQuizReviewState, { type: 'loaded', cards: [card('q1')] })
    s = quizReviewReducer(s, { type: 'choose', index: 0 })
    s = quizReviewReducer(s, { type: 'answered', chosenIndex: 0, result: result({ correct: true }) })
    expect(s).toMatchObject({ phase: 'revealed', index: 0, correctSoFar: 1, chosenIndex: 0 })
  })

  it('next on last card → summary with correct count and final streak', () => {
    let s = quizReviewReducer(initialQuizReviewState, { type: 'loaded', cards: [card('q1')] })
    s = quizReviewReducer(s, { type: 'choose', index: 0 })
    s = quizReviewReducer(s, { type: 'answered', chosenIndex: 0, result: result({ correct: true, streak: 7 }) })
    s = quizReviewReducer(s, { type: 'next' })
    expect(s).toEqual({ phase: 'summary', total: 1, correct: 1, streak: 7 })
  })

  it('next mid-session advances to the next question, preserving correctSoFar', () => {
    let s = quizReviewReducer(initialQuizReviewState, { type: 'loaded', cards: [card('q1'), card('q2')] })
    s = quizReviewReducer(s, { type: 'choose', index: 0 })
    s = quizReviewReducer(s, { type: 'answered', chosenIndex: 0, result: result({ correct: false }) })
    s = quizReviewReducer(s, { type: 'next' })
    expect(s).toMatchObject({ phase: 'question', index: 1, correctSoFar: 0, answering: false })
  })
})
