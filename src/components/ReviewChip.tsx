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
  return (
    <button
      className="review-chip dict-label"
      aria-label={`Review ${due} due words`}
      title={`Review ${due} due words`}
      onClick={() => window.electronAPI?.openReview?.()}
    >
      Review · {due}
    </button>
  )
}

export default ReviewChip
