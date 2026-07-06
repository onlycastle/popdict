import { useEffect, useMemo, useState } from 'react'
import { QuizSessionService } from '../services/QuizSessionService'

export function ReviewChip({ service }: { service?: QuizSessionService }): JSX.Element | null {
  const svc = useMemo(() => service ?? new QuizSessionService(), [service])
  const [due, setDue] = useState(0)

  useEffect(() => {
    let active = true
    svc.dueCount().then((n) => { if (active) setDue(n) }).catch(() => { /* ignore: chip just stays hidden */ })
    return () => { active = false }
  }, [svc])

  if (due <= 0) return null
  const noun = due === 1 ? 'word' : 'words'
  return (
    <button
      className="review-nudge"
      aria-label={`Review ${due} ${noun}`}
      title={`Review ${due} ${noun}`}
      onClick={() => window.electronAPI?.openReview?.()}
    >
      <span className="review-nudge__count">{due} {noun} to review</span>
      <span className="review-nudge__cta">Start →</span>
    </button>
  )
}

export default ReviewChip
