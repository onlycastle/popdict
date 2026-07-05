import type { Metadata } from 'next'
import { fetchReview } from '../answer/answer'

export const metadata: Metadata = {
  title: 'Quiz result — PopDict',
  description: 'Your PopDict word quiz answer.',
  robots: { index: false },
}

const ERROR_COPY: Record<string, string> = {
  invalid: 'That answer link looks malformed.',
  notfound: 'This quiz question no longer exists.',
  unavailable: 'We could not record your answer right now — try the link again in a minute.',
}

export default async function QuizResult({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const error = first(params.error)
  const q = first(params.q)
  const review = !error && q ? await fetchReview(q) : null

  if (error || !review) {
    return (
      <main className="container prose">
        <h1>Hmm.</h1>
        <p>{ERROR_COPY[error ?? 'unavailable'] ?? ERROR_COPY.unavailable}</p>
        <p>
          <a href="/">← PopDict</a>
        </p>
      </main>
    )
  }

  const { word, correct, correctAnswer, streak, material } = review

  return (
    <main className="container prose">
      <h1>{correct ? 'Correct!' : 'Not quite.'}</h1>
      <p>
        <strong>{word}</strong> means <strong>{correctAnswer}</strong>.
        {correct
          ? ' It will come back less often now.'
          : ' It will come back in tomorrow’s rotation until it sticks.'}
      </p>
      {material && (
        <>
          <p>{material.definition}</p>
          {material.examples.length > 0 && (
            <ul>
              {material.examples.map((example) => (
                <li key={example}>
                  <em>{example}</em>
                </li>
              ))}
            </ul>
          )}
          {material.similar.length > 0 && (
            <>
              <h2>Similar expressions</h2>
              <ul>
                {material.similar.map((s) => (
                  <li key={s.phrase}>
                    <strong>{s.phrase}</strong> — {s.nuance}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {streak > 0 && <p>Quiz streak: {streak} in a row. Keep it going.</p>}
      <p>
        <a href="/">← PopDict</a>
      </p>
    </main>
  )
}
