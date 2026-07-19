import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { QuizSessionService } from '../services/QuizSessionService'
import { initialQuizReviewState, quizReviewReducer } from './quizReview/quizReviewReducer'
import { productAnalytics } from '../services/ProductAnalytics'

export function QuizReviewView({ service }: { service?: QuizSessionService }): JSX.Element {
  const svc = useMemo(() => service ?? new QuizSessionService(), [service])
  const [state, dispatch] = useReducer(quizReviewReducer, initialQuizReviewState)
  const startedRef = useRef(false)
  const completionTrackedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    svc.startSession()
      .then((s) => dispatch({ type: 'loaded', cards: s.cards }))
      .catch(() => dispatch({ type: 'load_failed', message: 'Could not reach the review service. Check your connection.' }))
  }, [svc])

  useEffect(() => {
    if (state.phase === 'summary' && !completionTrackedRef.current) {
      completionTrackedRef.current = true
      void productAnalytics.track('review_session_completed')
    }
  }, [state.phase])

  const choose = async (card: { questionId: string }, index: number) => {
    dispatch({ type: 'choose', index })
    try {
      const result = await svc.answer(card.questionId, index)
      dispatch({ type: 'answered', chosenIndex: index, result })
    } catch {
      dispatch({ type: 'answer_failed' })
    }
  }

  if (state.phase === 'loading') {
    return <Shell><p className="dict-label">Loading…</p></Shell>
  }
  if (state.phase === 'empty') {
    return <Shell><p className="quiz-review__prompt">All caught up.</p><p className="dict-label">No words are due right now.</p></Shell>
  }
  if (state.phase === 'error') {
    return <Shell><p className="quiz-review__prompt">Something went wrong.</p><p className="dict-label">{state.message}</p></Shell>
  }
  if (state.phase === 'summary') {
    return (
      <Shell>
        <p className="quiz-review__prompt">{state.correct} / {state.total} correct</p>
        <p className="dict-label">streak {state.streak} · come back tomorrow</p>
        <button className="btn-ghost" onClick={() => window.electronAPI?.hideWindow?.()}>Done</button>
      </Shell>
    )
  }

  const card = state.cards[state.index]
  const result = state.phase === 'revealed' ? state.result : null
  const chosenIndex = state.phase === 'revealed' ? state.chosenIndex : null
  const promptText = card.kind === 'cloze' ? `Fill the blank: ${card.prompt}` : `Which meaning matches ${card.prompt}?`

  return (
    <Shell>
      <div className="quiz-review__top">
        <span className="dict-label">{state.index + 1} of {state.cards.length}</span>
        {result && <span className="dict-label">streak {result.streak}</span>}
      </div>
      <p className="quiz-review__prompt">{promptText}</p>
      <div className="quiz-review__options">
        {card.options.map((opt, i) => {
          const isCorrect = result !== null && opt === result.correctAnswer
          const isWrongPick = result !== null && i === chosenIndex && !result.correct
          return (
            <button
              key={i}
              className={`quiz-review__option${isCorrect ? ' quiz-review__option--correct' : ''}${isWrongPick ? ' quiz-review__option--wrong' : ''}`}
              disabled={state.phase !== 'question' || state.answering}
              onClick={() => choose(card, i)}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {result && result.material && (
        <div className="quiz-review__card">
          <p className="quiz-review__definition">{result.material.definition}</p>
          {result.material.examples[0] && <p className="quiz-review__example">{result.material.examples[0]}</p>}
          {result.material.similar.length > 0 && (
            <p className="dict-label">
              {result.material.similar.map((s) => s.phrase).join(' · ')}
            </p>
          )}
        </div>
      )}
      {state.phase === 'revealed' && (
        <button className="btn-primary quiz-review__next" onClick={() => dispatch({ type: 'next' })}>
          {state.index + 1 >= state.cards.length ? 'Finish' : 'Next'}
        </button>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="app-container">
      <div className="quiz-review">{children}</div>
    </div>
  )
}

export default QuizReviewView
