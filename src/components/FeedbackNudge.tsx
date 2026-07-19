type FeedbackNudgeProps = {
  onDismiss: () => void
  onShare: () => void
}

export default function FeedbackNudge({ onDismiss, onShare }: FeedbackNudgeProps) {
  return (
    <aside className="feedback-nudge" aria-label="Feedback request">
      <div>
        <strong>How is PopDict working so far?</strong>
        <p>One short note helps shape the next release.</p>
      </div>
      <div className="feedback-nudge-actions">
        <button type="button" className="btn-ghost text-xs" onClick={onDismiss}>
          Not now
        </button>
        <button type="button" className="btn-primary text-xs" onClick={onShare}>
          Share feedback
        </button>
      </div>
    </aside>
  )
}
