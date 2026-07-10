import type { AnswerResult, SessionCard } from '../../services/QuizSessionService'

export type QuizReviewState =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'error'; message: string }
  | { phase: 'question'; cards: SessionCard[]; index: number; correctSoFar: number; answering: boolean }
  | { phase: 'revealed'; cards: SessionCard[]; index: number; correctSoFar: number; chosenIndex: number; result: AnswerResult }
  | { phase: 'summary'; total: number; correct: number; streak: number }

export type QuizReviewAction =
  | { type: 'loaded'; cards: SessionCard[] }
  | { type: 'load_failed'; message: string }
  | { type: 'choose'; index: number }
  | { type: 'answered'; chosenIndex: number; result: AnswerResult }
  | { type: 'answer_failed' }
  | { type: 'next' }

export const initialQuizReviewState: QuizReviewState = { phase: 'loading' }

export function quizReviewReducer(state: QuizReviewState, action: QuizReviewAction): QuizReviewState {
  switch (action.type) {
    case 'loaded':
      return action.cards.length === 0
        ? { phase: 'empty' }
        : { phase: 'question', cards: action.cards, index: 0, correctSoFar: 0, answering: false }
    case 'load_failed':
      return { phase: 'error', message: action.message }
    case 'choose':
      return state.phase === 'question' ? { ...state, answering: true } : state
    case 'answered':
      if (state.phase !== 'question') return state
      return {
        phase: 'revealed',
        cards: state.cards,
        index: state.index,
        correctSoFar: state.correctSoFar + (action.result.correct ? 1 : 0),
        chosenIndex: action.chosenIndex,
        result: action.result,
      }
    case 'answer_failed':
      return state.phase === 'question' ? { ...state, answering: false } : state
    case 'next': {
      if (state.phase !== 'revealed') return state
      const nextIndex = state.index + 1
      if (nextIndex >= state.cards.length) {
        return { phase: 'summary', total: state.cards.length, correct: state.correctSoFar, streak: state.result.streak }
      }
      return { phase: 'question', cards: state.cards, index: nextIndex, correctSoFar: state.correctSoFar, answering: false }
    }
    default:
      return state
  }
}
