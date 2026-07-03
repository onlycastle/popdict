import type { Metadata } from 'next'

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
  const word = first(params.word)
  const correct = first(params.correct) === '1'
  const answer = first(params.answer)
  const streak = first(params.streak)

  return (
    <main className="container prose">
      {error ? (
        <>
          <h1>Hmm.</h1>
          <p>{ERROR_COPY[error] ?? ERROR_COPY.unavailable}</p>
        </>
      ) : (
        <>
          <h1>{correct ? 'Correct!' : 'Not quite.'}</h1>
          <p>
            <strong>{word}</strong> means <strong>{answer}</strong>.
            {correct
              ? ' It will come back less often now.'
              : ' It will come back in tomorrow’s rotation until it sticks.'}
          </p>
          {streak && Number(streak) > 0 && <p>Quiz streak: {streak} in a row. Keep it going.</p>}
        </>
      )}
      <p>
        <a href="/">← PopDict</a>
      </p>
    </main>
  )
}
