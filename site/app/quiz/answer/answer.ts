const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseAnswerParams(params: URLSearchParams): { q: string; c: number } | null {
  const q = params.get('q') ?? ''
  const cRaw = params.get('c')
  const c = cRaw === null || cRaw.trim() === '' ? NaN : Number(cRaw)
  if (!UUID_RE.test(q) || !Number.isInteger(c) || c < 0 || c > 3) return null
  return { q, c }
}

export type AnswerOutcome = {
  error?: string
  word?: string
  correct?: boolean
  correctAnswer?: string
  streak?: number
}

export function resultPath(outcome: AnswerOutcome): string {
  const params = new URLSearchParams()
  if (outcome.error) params.set('error', outcome.error)
  else {
    params.set('word', outcome.word ?? '')
    params.set('correct', outcome.correct ? '1' : '0')
    params.set('answer', outcome.correctAnswer ?? '')
    params.set('streak', String(outcome.streak ?? 0))
  }
  return `/quiz/result?${params.toString()}`
}

// Forward the click to the quiz function; the question uuid is the capability.
export async function forwardAnswer(q: string, c: number): Promise<AnswerOutcome> {
  const base = process.env.QUIZ_FN_URL
  if (!base) return { error: 'unavailable' }
  const res = await fetch(`${base}?action=answer&q=${q}&c=${c}`)
  if (!res.ok) return { error: res.status === 404 ? 'notfound' : 'unavailable' }
  const body = await res.json()
  return {
    word: body.word,
    correct: Boolean(body.correct),
    correctAnswer: body.correctAnswer,
    streak: body.streak,
  }
}
